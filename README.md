# @axiosleo/orm-mysql


[![NPM version](https://img.shields.io/npm/v/@axiosleo/orm-mysql.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/orm-mysql)
[![npm download](https://img.shields.io/npm/dm/@axiosleo/orm-mysql.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/orm-mysql)
[![node version](https://img.shields.io/badge/node.js-%3E=_16.0-green.svg?style=flat-square)](http://nodejs.org/download/)
[![License](https://img.shields.io/github/license/AxiosLeo/node-orm-mysql?color=%234bc524)](LICENSE)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-orm-mysql.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-orm-mysql?ref=badge_shield)

## Installation

```bash
npm install @axiosleo/orm-mysql
```

## Usage

### Create MySQL client

```javascript
const { createClient } = require("@axiosleo/orm-mysql");

const client = createClient({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
});
```

### Initialize database handler

```javascript
const { QueryHandler } = require("@axiosleo/orm-mysql");

const db = new QueryHandler(client);
```

### Initialize query

```javascript
const query = db.table('<table-name>');

query.attr("id", "name", "age"); // set attributes
query.where("name", "Joe");      // set where condition
query.orWhere("age", ">", 18);   // set or where condition
query.andWhere("age", "<", 30);  // set and where condition
query.orderBy("age", "desc");    // set order by
query.limit(10);                 // set limit
query.offset(0);                 // set offset

let rows = await query.select(); // select
```

### Some Query Examples

```javascript
const { createClient, QueryHandler, Query } = require("@axiosleo/orm-mysql");

const conn = createClient({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
});

const hanlder = new QueryHandler(conn);

async function selectExample() {
  const query = handler.table("users"); // init QueryOperator by table name

  query.attr("id", "name", "age"); // set attributes
  query.where("name", "Joe");      // set where condition
  query.orWhere("age", ">", 18);   // set or where condition
  query.andWhere("age", "<", 30);  // set and where condition
  query.orderBy("age", "desc");    // set order by
  query.limit(10);                 // set limit
  query.offset(0);                 // set offset

  let rows = await query.select(); // select
}

async function findExample() {
  const query = handler.table("users"); // init QueryOperator by table name

  query.attr("id", "name", "age");      // set attributes
  query.where("name", "Joe");           // set where condition
  query.orWhere("age", ">", 18);        // set or where condition
  query.andWhere("age", "<", 30);       // set and where condition
  query.orderBy("age", "desc");         // set order by
  // query.limit(10);                   // not supported set limit
  // query.offset(10);                  // not supported set offset

  let row = await query.find();         // find single row
}

async function insertExample() {
  const query = handler.table("users");

  // insert
  let row = await query.insert({
    name: "Joe",
    age: 18,
  });

  // The insert operation will be changed to the update operation if the uuid already exists
  row = await query.keys('uuid').insert({
    uuid: 'uuid-string', // uuid is unique index
    name: "Joe",
    age: 18,
  })
}

async function updateExample() {
  const query = handler.table("users");

  // update
  let row = await query.where("name", "Joe").update({
    name: "Joe",
    age: 18,
  });

  // incrBy with number
  row = await query.where("name", "Joe").incrBy("age", 1);

  // incrBy with string
  row = await query.where("name", "Joe").incrBy("age", "1");

  // incrBy with Callback
  let result = { status: "success" };
  row = await query.where("id", 1).incrBy("error_times", () => {
    // increase error_times if result.status is not success
    if (result.status !== "success") {
      return 1;
    }
    return 0;
  });
}

async function deleteExample() {
  const query = handler.table("users");

  // delete with conditions
  let result = await query.where("name", "Joe").delete();

  // delete by id
  result = await query.delete(1);
}

async function subqueryExample() {
  const query = handler.table("users", "u");
  const subQuery = new Query("select");
  subQuery.table("users").having("COUNT(*)", ">", 1);

  const sql = query.where("u.name", subQuery, "IN").buildSql("select").sql;
  // SELECT * FROM `users` AS `u` WHERE `u`.`name` IN (SELECT * FROM `users` GROUP BY `u`.`name` HAVING COUNT(*) > ?)
}
```

### Hook

```javascript
const { Hook } = require("@axiosleo/orm-mysql");

// opt: 'select' | 'find' | 'insert' | 'update' | 'delete' | 'count'

Hook.pre(async (options) => {
  debug.log('options', options);
}, { table: 'table_name', opt: 'insert'});

Hook.post(async (options, result) => {
  throw new Error('some error');
}, { table: 'table_name', opt: 'insert' });
```

### Transaction

#### Method 1: Using Connection Pool (Recommended)

```javascript
const mysql = require("mysql2");
const { QueryHandler } = require("@axiosleo/orm-mysql");

// Create connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  connectionLimit: 10
});

const handler = new QueryHandler(pool);

// Begin transaction - automatically gets a connection from pool
const transaction = await handler.beginTransaction({ 
  level: "RC" // READ COMMITTED
});

try {
  // Insert user info
  let row = await transaction.table("users").insert({
    name: "Joe",
    age: 18,
  });
  const lastInsertId = row.insertId;

  // Insert student info
  await transaction.table("students").insert({
    user_id: lastInsertId,
  });
  
  // Commit transaction - connection automatically released back to pool
  await transaction.commit();
} catch (e) {
  // Rollback transaction - connection automatically released back to pool
  await transaction.rollback();
  throw e;
}
```

#### Method 2: Using TransactionHandler Directly

```javascript
const { TransactionHandler, createPromiseClient } = require("@axiosleo/orm-mysql");

const conn = await createPromiseClient({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
});

const transaction = new TransactionHandler(conn, {
  /*
  Transaction Isolation Levels:
  - 'READ UNCOMMITTED' | 'RU'  : Lowest isolation, may read dirty data
  - 'READ COMMITTED'   | 'RC'  : Prevents dirty reads
  - 'REPEATABLE READ'  | 'RR'  : MySQL default, prevents non-repeatable reads
  - 'SERIALIZABLE'     | 'S'   : Highest isolation, full serialization
  */
  level: "SERIALIZABLE", // 'SERIALIZABLE' as default value
});
await transaction.begin();

try {
  // Insert user info
  let row = await transaction.table("users").insert({
    name: "Joe",
    age: 18,
  });
  const lastInsertId = row[0].insertId;

  // Insert student info
  await transaction.table("students").insert({
    user_id: lastInsertId,
  });
  await transaction.commit();
} catch (e) {
  await transaction.rollback();
  throw e;
}
```

#### Row Locking with FOR UPDATE

```javascript
const transaction = await handler.beginTransaction({ level: "RC" });

try {
  // Lock rows for update
  const product = await transaction.table("products")
    .where("sku", "LAPTOP-001")
    .append("FOR UPDATE")  // Lock the row
    .find();

  if (product.stock < 1) {
    throw new Error("Out of stock");
  }

  // Update stock
  await transaction.table("products")
    .where("sku", "LAPTOP-001")
    .update({ stock: product.stock - 1 });

  // Create order
  await transaction.table("orders").insert({
    product_id: product.id,
    quantity: 1,
    total: product.price
  });

  await transaction.commit();
} catch (e) {
  await transaction.rollback();
  throw e;
}
```

#### Concurrent Transactions

When using a connection pool, multiple transactions can run concurrently without blocking each other:

```javascript
const pool = mysql.createPool({ /* ... */ });
const handler = new QueryHandler(pool);

// Run 3 transactions concurrently
await Promise.all([
  (async () => {
    const tx = await handler.beginTransaction();
    try {
      await tx.table("users").insert({ name: "User1" });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  })(),
  
  (async () => {
    const tx = await handler.beginTransaction();
    try {
      await tx.table("users").insert({ name: "User2" });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  })(),
  
  (async () => {
    const tx = await handler.beginTransaction();
    try {
      await tx.table("users").insert({ name: "User3" });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  })()
]);
```

#### Best Practices

1. **Always use connection pools in production** - Prevents connection exhaustion and enables concurrent transactions
2. **Choose appropriate isolation level** - Balance between consistency and performance
3. **Use try-catch-finally** - Ensure transactions are always committed or rolled back
4. **Keep transactions short** - Avoid long-running operations inside transactions
5. **Use row locking when needed** - `FOR UPDATE` prevents concurrent modifications
6. **Handle errors properly** - Always rollback on errors to maintain data consistency

### Migration

> [Migration examples](./examples/migration/).

- Migration script example

```javascript
'use strict';

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function up(migration) {
  migration.createTable('table1', {
    field1: {
      type: 'varchar',
      length: 64,
      allowNull: false,
      uniqIndex: true
    },
    field2: {
      type: 'VARCHAR',
      allowNull: false
    },
    field3: {
      type: 'VARCHAR',
      comment: 'comment',
      allowNull: false
    },
  });
}

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function down(migration) {
  migration.dropTable('table1');
}

module.exports = {
  up,
  down
};
```

- Generate migration script

```bash
orm-mysql generate -h

Usage:

  generate [--] [name] <dir>
  gen

Arguments:

 *name    Migration name
  dir     Migration scripts directory
```

- Run migration

```bash
orm-mysql migrate -h

Description:

  Migrate database

Usage:

  migrate [options] [--] [action] <dir>

Options:

  -d, --debug    [false] debug mode
  --host         [localhost] mysql host
  --port         [3306] port number to connect to the database
  --user         [root] username for connect to the database
  --pass         password to connect to the database
  --db           database name

Arguments:

 *action         up or down
  dir            migration directory
```

### Custom query driver

```javascript
const { 
  createClient, 
  QueryHandler, 
  Query,
  Builder 
} = require("@axiosleo/orm-mysql");

const conn = createClient({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
});

const hanlder = new QueryHandler(conn, {
  driver: 'custom',
  queryHandler: (con, options) => {
    const builder = new Builder(options);
    return new Promise((resolve, reject) => {
      if (options.operator === 'select') {
        resolve([{ a: 1, b: 2 }]);
      } else {
        reject(new Error('some error'));
      }
    });
  }
});
```

## License

This project is open-sourced software licensed under [MIT](LICENSE).


[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-orm-mysql.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-orm-mysql?ref=badge_large)
