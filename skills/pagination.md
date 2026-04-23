# Pagination

Best practices for building paginated list endpoints with `@axiosleo/orm-mysql`.

## Critical Rule

**For paginated queries, always reuse the SAME query builder for both `count()` and `select()`.**
NEVER construct a separate `countBuilder` and re-apply the same `where` conditions.

The `Query` instance returned by `db.table(...)` is a mutable object: each `where()`, `whereIn()`, `leftJoin()`, etc. mutates `this.options` and returns `this`. Calling `count()` on a builder does NOT consume or invalidate it -- you can chain `select()` afterwards on the very same instance.

## Anti-Pattern: Duplicating Conditions for COUNT

The following pattern is wrong. It is verbose, fragile, and a maintenance hazard: every time a filter is added or changed, both builders must be updated, and forgetting one of them silently desynchronizes `total` from the actual result set.

```javascript
// BAD -- do not write code like this
let queryBuilder = this.companyDB
  .table(this.plansTable, 'pp')
  .attr('pp.plan_no', 'pp.title', 'pp.plan_type', 'pp.status', 'pp.created_at')
  .attr('u.name as created_by_name')
  .leftJoin('users', 'pp.created_by=u.id', { alias: 'u' });

if (query.plan_no) {
  queryBuilder = queryBuilder.where('pp.plan_no', 'like', `%${query.plan_no}%`);
}
if (query.status) {
  queryBuilder = queryBuilder.where('pp.status', query.status);
}
if (query.plan_type) {
  queryBuilder = queryBuilder.where('pp.plan_type', query.plan_type);
}
queryBuilder = queryBuilder.where('pp.disabled', 0);

const page = query.page || 1;
const pageSize = query.page_size || 10;
const offset = (page - 1) * pageSize;

// BAD: a second builder that re-declares the same table and re-applies every where
const countBuilder = this.companyDB
  .table(this.plansTable, 'pp')
  .where('pp.disabled', 0);
if (query.plan_no) {
  countBuilder.where('pp.plan_no', 'like', `%${query.plan_no}%`);
}
if (query.status) {
  countBuilder.where('pp.status', query.status);
}
if (query.plan_type) {
  countBuilder.where('pp.plan_type', query.plan_type);
}

const total = await countBuilder.count();

const plans = await queryBuilder
  .orderBy('pp.created_at', 'desc')
  .limit(pageSize)
  .offset(offset)
  .select();
```

## Recommended Pattern: Reuse the Same Query Builder

Build the filters once on a single `queryBuilder`, then call `count()` followed by the chained `orderBy/limit/offset/select()` on the same instance.

```javascript
// GOOD
let queryBuilder = this.companyDB
  .table(this.plansTable, 'pp')
  .attr('pp.plan_no', 'pp.title', 'pp.plan_type', 'pp.status', 'pp.created_at')
  .attr('u.name as created_by_name')
  .leftJoin('users', 'pp.created_by=u.id', { alias: 'u' });

if (query.plan_no) {
  queryBuilder = queryBuilder.where('pp.plan_no', 'like', `%${query.plan_no}%`);
}
if (query.status) {
  queryBuilder = queryBuilder.where('pp.status', query.status);
}
if (query.plan_type) {
  queryBuilder = queryBuilder.where('pp.plan_type', query.plan_type);
}
queryBuilder = queryBuilder.where('pp.disabled', 0);

const page = query.page || 1;
const pageSize = query.page_size || 10;
const offset = (page - 1) * pageSize;

const total = await queryBuilder.count();

const plans = await queryBuilder
  .orderBy('pp.created_at', 'desc')
  .limit(pageSize)
  .offset(offset)
  .select();
```

Note how the filter block (`if (query.xxx) { ... }`) appears exactly once. There is no second copy to keep in sync.

## Why This Is Safe

Three implementation details from this ORM make the single-builder pattern correct:

1. **`Query.options` is mutable, methods return `this`.** Every chain call (`where`, `whereIn`, `leftJoin`, `attr`, `orderBy`, `limit`, `offset`, ...) mutates `this.options` on the same instance. There is no copy-on-write.

2. **`count()` ignores `attrs`, `limit`, `offset`, and `orderBy`.** The COUNT SQL is built by `_countOperator` in `src/builder.js`, which only consumes `tables`, `joins`, `conditions`, `groupField`, and `having`. It emits `SELECT COUNT(*) AS count FROM ...` and never reads the `attr()` list, the limit/offset, or the order-by list. So having those configured on the builder does not affect the count.

3. **`select()` overwrites `operator`.** `count()` sets `this.options.operator = 'count'`. `select()` then sets `this.options.operator = 'select'`, restoring the correct execution path. The two calls can safely happen on the same instance, in either order.

## Recommended Order

Call `count()` BEFORE chaining `orderBy`/`limit`/`offset`. Even though `count()` would ignore them anyway, this ordering keeps the read intent obvious:

```javascript
// 1. assemble all where / join / attr
// 2. take the total
const total = await queryBuilder.count();

// 3. then add purely "presentation" concerns and fetch the page
const list = await queryBuilder
  .orderBy('pp.created_at', 'desc')
  .limit(pageSize)
  .offset(offset)
  .select();
```

## Complete Pagination Template

A drop-in template for a typical "list with filters" endpoint:

```javascript
async function listPlans(query) {
  let q = db.table('procurement_plans', 'pp')
    .attr('pp.plan_no', 'pp.title', 'pp.plan_type', 'pp.status', 'pp.created_at')
    .attr('u.name as created_by_name')
    .leftJoin('users', 'pp.created_by=u.id', { alias: 'u' })
    .where('pp.disabled', 0);

  if (query.plan_no) {
    q = q.where('pp.plan_no', 'like', `%${query.plan_no}%`);
  }
  if (query.status) {
    q = q.where('pp.status', query.status);
  }
  if (query.plan_type) {
    q = q.where('pp.plan_type', query.plan_type);
  }

  const page = Number(query.page) || 1;
  const pageSize = Number(query.page_size) || 10;
  const offset = (page - 1) * pageSize;

  const total = await q.count();

  const list = await q
    .orderBy('pp.created_at', 'desc')
    .limit(pageSize)
    .offset(offset)
    .select();

  return { list, total, page, page_size: pageSize };
}
```

## Edge Case: GROUP BY

`count()` includes `GROUP BY` in the generated SQL, which means with grouping it returns one row per group rather than the total number of groups. In that case the same builder cannot be reused as-is for "how many groups are there".

Two valid approaches:

### Approach A: count via subquery

Wrap the grouped query as a subquery and count its rows. Build the inner query without `limit/offset/orderBy`, then count it:

```javascript
const { Query } = require('@axiosleo/orm-mysql');

const inner = new Query('select');
inner.table('orders', 'o')
  .attr('o.user_id')
  .where('o.status', 'paid')
  .groupBy('o.user_id');

const total = await db.table(inner, 'sub').count();

const rows = await db.table('orders', 'o')
  .attr('o.user_id', 'SUM(o.total) AS total')
  .where('o.status', 'paid')
  .groupBy('o.user_id')
  .orderBy('total', 'desc')
  .limit(pageSize)
  .offset(offset)
  .select();
```

### Approach B: dedicated count builder (only when grouping forces it)

If you genuinely need two builders because of grouping, factor the shared filters into a helper to keep them in sync:

```javascript
function applyFilters(q, query) {
  q.where('o.status', 'paid');
  if (query.user_id) q.where('o.user_id', query.user_id);
  return q;
}

const groupedQ = applyFilters(
  db.table('orders', 'o').attr('o.user_id', 'SUM(o.total) AS total').groupBy('o.user_id'),
  query
);
const countInner = applyFilters(
  new Query('select').table('orders', 'o').attr('o.user_id').groupBy('o.user_id'),
  query
);
const total = await db.table(countInner, 'sub').count();
const list = await groupedQ.orderBy('total', 'desc').limit(pageSize).offset(offset).select();
```

For all non-grouped paginated lists, stick to the single-builder pattern at the top of this file.
