# Query Building

The `Query` class provides the fluent API for constructing SQL queries. You get a `Query`-based instance (actually `QueryOperator`) from `QueryHandler.table()`.

```javascript
const query = db.table("users"); // returns QueryOperator (extends Query)
```

## Table Selection

### Single table

```javascript
db.table("users");
db.table("users", "u"); // with alias
```

### Multiple tables

```javascript
db.tables(
  { table: "users", alias: "u" },
  { table: "orders", alias: "o" }
);
```

## Selecting Columns with attr()

```javascript
// Select specific columns
query.attr("id", "name", "email");

// Using sub-query as attribute
const { Query } = require("@axiosleo/orm-mysql");

query.attr(
  "id",
  "name",
  () => {
    const sub = new Query("select");
    sub.table("orders").attr("COUNT(*)").where("orders.user_id", "users.id");
    return sub;
  }
);
```

Calling `attr()` with no arguments clears all previously set attributes.

## Pagination

### limit and offset

```javascript
query.limit(10);       // LIMIT 10
query.offset(20);      // OFFSET 20
```

### page (shorthand)

```javascript
query.page(10);        // LIMIT 10 OFFSET 0
query.page(10, 2);     // LIMIT 10 OFFSET 2
```

## Sorting

```javascript
query.orderBy("created_at", "desc");
query.orderBy("name", "asc");
// Multiple orderBy calls are cumulative
```

## Grouping and Aggregation

```javascript
query.groupBy("status");
query.groupBy("status", "category"); // multiple fields

// HAVING clause (requires groupBy)
query.groupBy("status").having("COUNT(*)", ">", 5);
```

## Setting Data

### set() -- for insert/update data

```javascript
query.set({ name: "Joe", age: 25 });
```

### keys() -- specify columns for INSERT with ON DUPLICATE KEY UPDATE

```javascript
query.keys("uuid").insert({
  uuid: "abc-123",
  name: "Joe",
  age: 25,
});
// If uuid already exists, the insert becomes an update
```

## Joins

### leftJoin / rightJoin / innerJoin (preferred)

```javascript
query.table("users", "u")
  .leftJoin("orders", "u.id = orders.user_id", { alias: "o" })
  .attr("u.id", "u.name", "o.total")
  .select();

query.table("users", "u")
  .rightJoin("orders", "u.id = orders.user_id")
  .select();

query.table("users", "u")
  .innerJoin("roles", "u.role_id = roles.id", { alias: "r" })
  .select();
```

### join() -- generic form

```javascript
query.join({
  table: "orders",
  table_alias: "o",
  self_column: "id",
  foreign_column: "user_id",
  join_type: "left",
});
```

### Sub-query as join table

```javascript
const { Query } = require("@axiosleo/orm-mysql");

const subQuery = new Query("select");
subQuery.table("orders").attr("user_id", "SUM(total) AS order_total").groupBy("user_id");

query.table("users", "u")
  .leftJoin(subQuery, "u.id = sub.user_id", { alias: "sub" })
  .select();
```

## Complete Example

```javascript
const users = await db.table("users", "u")
  .attr("u.id", "u.name", "u.email", "o.total")
  .leftJoin("orders", "u.id = orders.user_id", { alias: "o" })
  .where("u.status", "active")
  .whereBetween("u.created_at", ["2024-01-01", "2024-12-31"])
  .groupBy("u.id")
  .having("COUNT(o.id)", ">", 0)
  .orderBy("u.name", "asc")
  .page(20, 0)
  .select();
```
