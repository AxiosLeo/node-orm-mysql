# Transactions

## Isolation Levels

| Shorthand | Full Name | Description |
|-----------|-----------|-------------|
| `RU` | `READ UNCOMMITTED` | Lowest isolation, may read dirty data |
| `RC` | `READ COMMITTED` | Prevents dirty reads |
| `RR` | `REPEATABLE READ` | MySQL default, prevents non-repeatable reads |
| `S` | `SERIALIZABLE` | Highest isolation, full serialization |

## Method 1: Pool + beginTransaction (Recommended)

Use `QueryHandler.beginTransaction()` with a connection pool. The transaction automatically gets its own connection from the pool and releases it on commit/rollback.

```javascript
const { createPool, QueryHandler } = require("@axiosleo/orm-mysql");

const pool = createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "my_db",
  connectionLimit: 10,
});

const db = new QueryHandler(pool);

const tx = await db.beginTransaction({ level: "RC" });
try {
  const result = await tx.table("users").insert({ name: "Joe", age: 25 });
  const userId = result.insertId;

  await tx.table("profiles").insert({ user_id: userId, bio: "Hello" });

  await tx.commit();
} catch (err) {
  await tx.rollback();
  throw err;
}
```

## Method 2: TransactionHandler Directly

For more control, create a `TransactionHandler` with a promise connection.

```javascript
const { TransactionHandler, createPromiseClient } = require("@axiosleo/orm-mysql");

const conn = await createPromiseClient({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "my_db",
});

const tx = new TransactionHandler(conn, { level: "SERIALIZABLE" });
await tx.begin();

try {
  await tx.table("users").insert({ name: "Joe", age: 25 });
  await tx.commit();
} catch (err) {
  await tx.rollback();
  throw err;
}
```

## Row Locking

`TransactionOperator` (returned by `tx.table()`) extends `QueryOperator` with `append()` for SQL suffixes.

### FOR UPDATE

Locks selected rows, preventing other transactions from reading or modifying them.

```javascript
const tx = await db.beginTransaction({ level: "RC" });
try {
  const product = await tx.table("products")
    .where("sku", "LAPTOP-001")
    .append("FOR UPDATE")
    .find();

  if (product.stock < 1) {
    throw new Error("Out of stock");
  }

  await tx.table("products")
    .where("sku", "LAPTOP-001")
    .update({ stock: product.stock - 1 });

  await tx.table("orders").insert({
    product_id: product.id,
    quantity: 1,
    total: product.price,
  });

  await tx.commit();
} catch (err) {
  await tx.rollback();
  throw err;
}
```

### LOCK IN SHARE MODE

Allows other transactions to read but not modify the locked rows.

```javascript
const rows = await tx.table("products")
  .where("category", "electronics")
  .append("LOCK IN SHARE MODE")
  .select();
```

## TransactionHandler API

| Method | Description |
|--------|-------------|
| `begin()` | Start the transaction |
| `commit()` | Commit and release the connection |
| `rollback()` | Rollback and release the connection |
| `table(name, alias?)` | Returns `TransactionOperator` for the table |
| `query(options)` | Execute raw SQL within the transaction |
| `execute(sql, values)` | Execute parameterized SQL |
| `lastInsertId(alias?)` | Get the last auto-increment ID |
| `upsert(table, data, condition)` | Insert or update within the transaction |

## Concurrent Transactions

With a connection pool, multiple transactions run on separate connections without blocking each other.

```javascript
const db = new QueryHandler(pool);

await Promise.all([
  (async () => {
    const tx = await db.beginTransaction();
    try {
      await tx.table("users").insert({ name: "User1" });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  })(),

  (async () => {
    const tx = await db.beginTransaction();
    try {
      await tx.table("users").insert({ name: "User2" });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  })(),
]);
```

## Best Practices

1. **Use connection pools in production** -- prevents connection exhaustion
2. **Always wrap in try/catch** -- ensure rollback on errors
3. **Keep transactions short** -- avoid long-running operations inside transactions
4. **Choose the right isolation level** -- `RC` is a good default for most cases
5. **Use row locking when needed** -- `FOR UPDATE` prevents concurrent modification conflicts
6. **Prefer `beginTransaction()` over manual `TransactionHandler`** -- automatic connection management
