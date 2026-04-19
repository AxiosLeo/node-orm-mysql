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
