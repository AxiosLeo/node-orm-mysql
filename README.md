# @axiosleo/orm-mysql

## Installation

```bash
npm install @axiosleo/orm-mysql
```

## Usage

```javascript
const { createClient, QueryHandler } = require('@axiosleo/orm-mysql');

const conn = createClient({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
});

const hanlder = new QueryHandler(conn);

async function selectExample(){
    const query = handler.table('users');  // init QueryOperator by table name

    query.attr('id', 'name', 'age');  // set attributes
    query.where('name','Joe');        // set where condition
    query.orWhere('age', '>', 18);    // set or where condition
    query.andWhere('age', '<', 30);   // set and where condition
    query.orderBy('age', 'desc');     // set order by
    query.limit(10);                  // set limit
    query.offset(0);                  // set offset

    let rows = await query.select();  // select
}

async function findExample(){
    const query = handler.table('users');  // init QueryOperator by table name

    query.attr('id', 'name', 'age');  // set attributes
    query.where('name','Joe');        // set where condition
    query.orWhere('age', '>', 18);    // set or where condition
    query.andWhere('age', '<', 30);   // set and where condition
    query.orderBy('age', 'desc');     // set order by
    // query.limit(10);               // not supported set limit
    // query.offset(10);              // not supported set offset

    let row = await query.find();     // find single row
}

async function insertExample(){
    const query = handler.table('users');

    // insert
    let row = await query.insert({
        name: 'Joe',
        age: 18,
    });
}

async function updateExample(){
    const query = handler.table('users');

    // update
    let row = await query.where('name','Joe').update({
        name: 'Joe',
        age: 18,
    });
}

async function deleteExample(){
    const query = handler.table('users');

    // delete with conditions
    let result = await query.where('name','Joe').delete();

    // delete by id
    result = await query.delete(1);
}
```
```
