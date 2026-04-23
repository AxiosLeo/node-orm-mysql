# Where Conditions

The `QueryCondition` class provides all WHERE clause methods. All methods return `this` for chaining.

## Basic where()

### Key-value equality

```javascript
query.where("name", "Joe");          // WHERE `name` = ?
query.where("age", ">", 18);         // WHERE `age` > ?
query.where("status", "!=", "banned"); // WHERE `status` != ?
```

### Object form (multiple equalities)

```javascript
query.where({ name: "Joe", status: "active" });
// WHERE `name` = ? AND `status` = ?
```

### Supported operators

`=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `BETWEEN`, `NOT BETWEEN`, `IS`, `IS NOT`, `REGEXP`, `NOT REGEXP`, `CONTAIN`, `NOT CONTAIN`, `OVERLAPS`, `NOT OVERLAPS`

## Logical Operators

### AND / OR grouping

```javascript
// Switch to OR logic for subsequent conditions
query.where("OR");
// or equivalently:
query.whereOr();

// Switch back to AND logic
query.where("AND");
// or equivalently:
query.whereAnd();
```

### Combining AND/OR

```javascript
// WHERE `status` = ? AND (`age` > ? OR `vip` = ?)
query
  .where("status", "active")
  .whereOr()
  .where("age", ">", 18)
  .where("vip", true)
  .whereAnd();
```

## IN / NOT IN

```javascript
query.whereIn("status", ["active", "pending"]);
// WHERE `status` IN (?, ?)

query.whereNotIn("role", ["banned", "suspended"]);
// WHERE `role` NOT IN (?, ?)
```

### Sub-query in whereIn

```javascript
const { Query } = require("@axiosleo/orm-mysql");

const subQuery = new Query("select");
subQuery.table("orders").attr("user_id").where("total", ">", 100);

query.whereIn("id", subQuery);
// WHERE `id` IN (SELECT `user_id` FROM `orders` WHERE `total` > ?)
```

## LIKE / NOT LIKE

```javascript
query.whereLike("name", "%Joe%");
// WHERE `name` LIKE ?

query.whereNotLike("email", "%spam%");

// Multiple patterns (OR)
query.whereLike("name", ["%Joe%", "%Jane%"]);
```

## BETWEEN / NOT BETWEEN

```javascript
query.whereBetween("age", [18, 65]);
// WHERE `age` BETWEEN ? AND ?

query.whereNotBetween("created_at", ["2024-01-01", "2024-06-30"]);
```

## CONTAIN / NOT CONTAIN

For JSON array or SET column checks:

```javascript
query.whereContain("tags", "javascript");
// WHERE JSON_CONTAINS(`tags`, ?)

query.whereNotContain("tags", "deprecated");
```

## OVERLAPS / NOT OVERLAPS

For JSON array overlap checks:

```javascript
query.whereOverlaps("categories", [1, 2, 3]);

query.whereNotOverlaps("categories", [4, 5]);
```

## Nested Conditions with whereCondition()

Use `QueryCondition` to build complex nested conditions:

```javascript
const { QueryCondition } = require("@axiosleo/orm-mysql");

const nested = new QueryCondition();
nested.where("age", ">", 18).where("age", "<", 65);

query
  .where("status", "active")
  .whereCondition(nested);
// WHERE `status` = ? AND (`age` > ? AND `age` < ?)
```

### Default Joining Between Multiple `whereCondition()` Calls

Each `whereCondition()` call appends one parenthesized group to `WHERE`, joined to whatever came before with **`AND`**. There is no implicit `OR` between groups.

```javascript
const g1 = new QueryCondition();
g1.where("a", 1).whereOr().where("b", 2);

const g2 = new QueryCondition();
g2.where("c", 3).whereOr().where("d", 4);

query.where("status", "active")
  .whereCondition(g1)
  .whereCondition(g2);
// WHERE `status` = ? AND (`a` = ? OR `b` = ?) AND (`c` = ? OR `d` = ?)
```

### Combining Multiple Groups with `OR`: Wrap, Don't Sprinkle

To `OR` two groups together, do **not** insert a top-level `whereOr()` between them on the main builder. SQL evaluates `AND` before `OR`, so the surrounding filters silently bind only to the first group:

```javascript
// BAD -- generates: WHERE `status` = ? AND (`a` = ? OR `b` = ?) OR (`c` = ? OR `d` = ?)
// `status` = ? only constrains the first group. The second group OR's against everything.
query.where("status", "active")
  .whereCondition(g1)
  .whereOr()
  .whereCondition(g2);
```

Instead, build a single outer `QueryCondition` containing the `OR`'d groups, then attach it once:

```javascript
// GOOD -- generates: WHERE `status` = ? AND ((`a` = ? OR `b` = ?) OR (`c` = ? OR `d` = ?))
const outer = new QueryCondition();
outer.whereCondition(g1).whereOr().whereCondition(g2);

query.where("status", "active").whereCondition(outer);
```

Rule of thumb: `whereOr()` between two `whereCondition()` calls is safe **inside** a `QueryCondition` (it only changes that group's internal logic), but at the top level of the main query builder it leaks the `OR` past your other `AND` filters.

When the clauses you want to `OR` together are programmatically generated and share the same shape (e.g. an N-keyword fuzzy search across the same columns), skip the nested `g1`/`g2` and pour every clause directly into a single `QueryCondition` using its own `where()`/`whereOr()` calls -- then attach it to the main builder once. See [pagination.md](pagination.md) (Multi-Keyword Fuzzy Search) for the exact pattern.

## Complete Example

```javascript
const results = await db.table("products", "p")
  .where("p.status", "active")
  .whereBetween("p.price", [10, 100])
  .whereIn("p.category_id", [1, 2, 3])
  .whereLike("p.name", "%phone%")
  .whereNotIn("p.id", blockedIds)
  .orderBy("p.price", "asc")
  .page(20, 0)
  .select();
```
