---
name: orm-mysql-usage
description: Build MySQL queries, perform CRUD operations, and manage transactions using @axiosleo/orm-mysql. Use when writing database queries, building where conditions, inserting/updating/deleting rows, managing transactions, or working with the ORM query builder in this project.
---

# @axiosleo/orm-mysql Usage Guide

## Installation

```bash
npm install @axiosleo/orm-mysql
```

## Setup

### Create a Connection

```javascript
const { createClient, QueryHandler } = require("@axiosleo/orm-mysql");

const conn = createClient({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "my_db",
});

const db = new QueryHandler(conn);
```

### Create a Connection Pool (recommended for production)

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
```

### Using MySQLClient

```javascript
const { MySQLClient } = require("@axiosleo/orm-mysql");

const client = new MySQLClient({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "my_db",
}, null, "pool"); // "default" | "promise" | "pool"

const rows = await client.table("users").select();
await client.close();
```

## Class Hierarchy

```
QueryCondition      -- where clauses (where, whereIn, whereLike, whereBetween...)
  └── Query         -- query building (table, attr, join, orderBy, limit, page...)
        └── QueryOperator          -- execution (select, find, insert, update, delete...)
              └── TransactionOperator  -- adds append() for row locking
```

- `QueryHandler` wraps a connection/pool and creates `QueryOperator` via `.table(name)`
- `TransactionHandler` wraps a promise connection and creates `TransactionOperator` via `.table(name)`

## Quick Start

```javascript
const db = new QueryHandler(conn);

// SELECT
const users = await db.table("users")
  .where("age", ">", 18)
  .orderBy("name", "asc")
  .limit(10)
  .select("id", "name", "age");

// INSERT
await db.table("users").insert({ name: "Joe", age: 25 });

// UPDATE
await db.table("users").where("id", 1).update({ age: 26 });

// DELETE
await db.table("users").where("id", 1).delete();

// COUNT
const total = await db.table("users").where("age", ">", 18).count();

// FIND single row
const user = await db.table("users").where("id", 1).find();
```

## Dry Run with notExec()

Call `notExec()` before any CRUD method to get a `Builder` object with `.sql` and `.values` instead of executing:

```javascript
const builder = await db.table("users")
  .where("age", ">", 18)
  .notExec()
  .select("id", "name");

console.log(builder.sql);    // "SELECT `id`, `name` FROM `users` WHERE `age` > ?"
console.log(builder.values); // [18]
```

## Reference Files

| Scenario | File |
|----------|------|
| Building queries (table, join, orderBy, limit, groupBy, attr) | [query-building.md](query-building.md) |
| Where conditions (where, whereIn, whereLike, whereBetween...) | [where-conditions.md](where-conditions.md) |
| CRUD operations (select, find, count, insert, update, delete, incrBy, upsertRow) | [crud-operations.md](crud-operations.md) |
| Transactions (beginTransaction, commit, rollback, FOR UPDATE) | [transactions.md](transactions.md) |

## Hooks

Register pre/post hooks for query operations:

```javascript
const { Hook } = require("@axiosleo/orm-mysql");

Hook.pre(async (options) => {
  console.log("Before:", options.operator, options.tables);
}, { table: "users", opt: "insert" });

Hook.post(async (options, result) => {
  console.log("After:", result);
}, { table: "users", opt: "insert" });
```

## Schema Helpers

```javascript
const exists = await db.existTable("users");
const dbExists = await db.existDatabase("my_db");
const fields = await db.getTableFields("my_db", "users", "COLUMN_NAME", "DATA_TYPE");
```

## Raw SQL

```javascript
const result = await db.query({ sql: "SELECT * FROM users WHERE id = ?", values: [1] });
```
