# CRUD Operations

The `QueryOperator` class provides all execution methods. You get an instance via `db.table("name")`.

All CRUD methods return a `Promise`. Write operations resolve to `MySQLQueryResult` (OkPacket | ResultSetHeader). If `notExec()` was called, they resolve to a `Builder` object instead.

## Read Operations

### select(...attrs)

Returns an array of rows. Optionally pass column names to override previously set `attr()`.

```javascript
const rows = await db.table("users").select();
const rows = await db.table("users").select("id", "name", "email");

// With TypeScript generics
interface User { id: number; name: string; email: string; }
const users = await db.table("users").select<User>("id", "name", "email");
```

### find()

Returns a single row (the first match). Automatically applies `LIMIT 1`.

```javascript
const user = await db.table("users").where("id", 1).find();

// With TypeScript generics
const user = await db.table("users").where("id", 1).find<User>();
```

### count()

Returns the total number of matching rows as a number.

```javascript
const total = await db.table("users").where("status", "active").count();
// total is a number
```

### explain(operator)

Returns the MySQL EXPLAIN result for the query.

```javascript
const plan = await db.table("users")
  .where("status", "active")
  .explain("select");
// plan is ExplainResult[]
```

## Write Operations

### insert(row)

Insert a single row.

```javascript
const result = await db.table("users").insert({
  name: "Joe",
  age: 25,
  email: "joe@example.com",
});
// result.insertId -- the auto-increment ID
// result.affectedRows -- number of rows inserted
```

### Insert with ON DUPLICATE KEY UPDATE

Use `keys()` to specify unique columns. If a duplicate is found, the operation becomes an update.

```javascript
const result = await db.table("users").keys("email").insert({
  email: "joe@example.com",
  name: "Joe Updated",
  age: 26,
});
```

### insertAll(rows)

Insert multiple rows. Returns an array of results.

```javascript
const results = await db.table("users").insertAll([
  { name: "Alice", age: 30 },
  { name: "Bob", age: 28 },
  { name: "Charlie", age: 35 },
]);
// results is MySQLQueryResult[]
```

### update(row)

Update rows matching the current where conditions.

```javascript
const result = await db.table("users")
  .where("id", 1)
  .update({ name: "Joe Updated", age: 26 });
// result.affectedRows -- number of rows updated
// result.changedRows  -- number of rows actually changed
```

### delete(id?, index_field_name?)

Delete rows. Can be called with conditions or directly with an ID.

```javascript
// Delete by conditions
const result = await db.table("users").where("status", "banned").delete();

// Delete by primary key (defaults to "id" field)
const result = await db.table("users").delete(1);

// Delete by a custom index field
const result = await db.table("users").delete(1, "user_id");
```

### incrBy(attr, increment?)

Increment a column value atomically. Default increment is 1.

```javascript
// Increment by 1 (default)
await db.table("users").where("id", 1).incrBy("login_count");

// Increment by a specific number
await db.table("products").where("id", 1).incrBy("views", 5);

// Increment by string value
await db.table("users").where("id", 1).incrBy("score", "10");

// Conditional increment with callback
await db.table("users").where("id", 1).incrBy("error_count", (current) => {
  return shouldIncrement ? 1 : 0;
});
```

### upsertRow(row, condition)

Insert a row or update it if a matching row exists based on the condition.

```javascript
// Using QueryCondition
const condition = new QueryCondition();
condition.where("email", "joe@example.com");

await db.table("users").upsertRow(
  { email: "joe@example.com", name: "Joe", age: 25 },
  condition
);
```

## Dry Run with notExec()

Call `notExec()` before any CRUD method to get the generated SQL without executing it. Returns a `Builder` with `.sql` and `.values`.

```javascript
const builder = await db.table("users")
  .where("status", "active")
  .orderBy("name", "asc")
  .limit(10)
  .notExec()
  .select("id", "name");

console.log(builder.sql);    // The generated SQL string
console.log(builder.values); // The parameter values array
```

This works with all CRUD methods:

```javascript
const insertBuilder = await db.table("users")
  .notExec()
  .insert({ name: "Joe", age: 25 });

const updateBuilder = await db.table("users")
  .where("id", 1)
  .notExec()
  .update({ age: 26 });

const deleteBuilder = await db.table("users")
  .where("id", 1)
  .notExec()
  .delete();
```

## Complete Example

```javascript
const db = new QueryHandler(pool);

// Create user
const insertResult = await db.table("users").insert({
  name: "Joe",
  email: "joe@example.com",
  age: 25,
});
const userId = insertResult.insertId;

// Read back
const user = await db.table("users").where("id", userId).find();

// Update
await db.table("users").where("id", userId).update({ age: 26 });

// Increment login count
await db.table("users").where("id", userId).incrBy("login_count");

// Count active users
const activeCount = await db.table("users").where("status", "active").count();

// Bulk insert
await db.table("logs").insertAll([
  { user_id: userId, action: "login" },
  { user_id: userId, action: "view_profile" },
]);

// Delete
await db.table("sessions").where("expired_at", "<", new Date()).delete();
```
