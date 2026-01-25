'use strict';

/**
 * PostgreSQL Feature Tests
 * 
 * Run with: docker compose up -d && sleep 5 && node tests/postgre.ft.js
 */

const { 
  PostgreClient, 
  createPool, 
  createClient, 
  createPromiseClient,
  TransactionHandler 
} = require('../index');
const { PostgreBuilder, PostgreManageSQLBuilder } = require('../src/postgre-builder');

const connectionConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '3AQqZTfmww=Ftj',
  database: 'feature_tests',
  driver: 'postgre'
};

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  
  const client = createClient(connectionConfig, 'pg-test');
  
  try {
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✓ Connection successful:', result.rows[0].current_time);
    await client.end();
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    process.exit(1);
  }
}

async function testPool() {
  console.log('\nTesting PostgreSQL pool...');
  
  const pool = createPool({ ...connectionConfig, max: 5 }, 'pg-pool-test');
  
  try {
    const result = await pool.query('SELECT 1 + 1 as sum');
    console.log('✓ Pool query successful:', result.rows[0].sum);
    await pool.end();
  } catch (err) {
    console.error('✗ Pool test failed:', err.message);
    process.exit(1);
  }
}

async function testPromiseClient() {
  console.log('\nTesting PostgreSQL promise client...');
  
  try {
    const client = await createPromiseClient(connectionConfig, 'pg-promise-test');
    const result = await client.query('SELECT version()');
    console.log('✓ Promise client successful');
    await client.end();
  } catch (err) {
    console.error('✗ Promise client failed:', err.message);
    process.exit(1);
  }
}

async function testPostgreClient() {
  console.log('\nTesting PostgreClient class...');
  
  const client = new PostgreClient({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '3AQqZTfmww=Ftj',
    database: 'feature_tests'
  }, 'pg-client-test', 'default');
  
  try {
    // Create test table
    await client.conn.query(`
      DROP TABLE IF EXISTS pg_test_users;
      CREATE TABLE pg_test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        age INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table created');
    
    // Test insert
    const insertResult = await client.table('pg_test_users').insert({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });
    console.log('✓ Insert successful');
    
    // Test select
    const users = await client.table('pg_test_users').select();
    console.log('✓ Select successful, found', users.length, 'users');
    
    // Test find
    const user = await client.table('pg_test_users').where('name', 'John Doe').find();
    console.log('✓ Find successful:', user ? user.name : 'not found');
    
    // Test count
    const count = await client.table('pg_test_users').count();
    console.log('✓ Count successful:', count);
    
    // Test update
    await client.table('pg_test_users').where('name', 'John Doe').update({ age: 31 });
    const updatedUser = await client.table('pg_test_users').where('name', 'John Doe').find();
    console.log('✓ Update successful, age:', updatedUser.age);
    
    // Test insertAll
    await client.table('pg_test_users').insertAll([
      { name: 'Jane Doe', email: 'jane@example.com', age: 25 },
      { name: 'Bob Smith', email: 'bob@example.com', age: 35 }
    ]);
    const allUsers = await client.table('pg_test_users').select();
    console.log('✓ InsertAll successful, total users:', allUsers.length);
    
    // Test where conditions
    const youngUsers = await client.table('pg_test_users').where('age', '<', 30).select();
    console.log('✓ Where condition successful, young users:', youngUsers.length);
    
    // Test order by
    const orderedUsers = await client.table('pg_test_users').orderBy('age', 'desc').select();
    console.log('✓ Order by successful, first user age:', orderedUsers[0].age);
    
    // Test limit/offset
    const limitedUsers = await client.table('pg_test_users').limit(2).offset(1).select();
    console.log('✓ Limit/offset successful, got:', limitedUsers.length, 'users');
    
    // Test delete
    await client.table('pg_test_users').where('name', 'Bob Smith').delete();
    const afterDelete = await client.table('pg_test_users').count();
    console.log('✓ Delete successful, remaining users:', afterDelete);
    
    // Test existTable
    const tableExists = await client.existTable('pg_test_users');
    console.log('✓ existTable successful:', tableExists);
    
    // Test existDatabase
    const dbExists = await client.existDatabase('feature_tests');
    console.log('✓ existDatabase successful:', dbExists);
    
    // Clean up
    await client.conn.query('DROP TABLE pg_test_users');
    console.log('✓ Cleanup successful');
    
    await client.close();
  } catch (err) {
    console.error('✗ PostgreClient test failed:', err.message);
    console.error(err.stack);
    await client.close();
    process.exit(1);
  }
}

async function testTransaction() {
  console.log('\nTesting PostgreSQL transaction...');
  
  const client = await createPromiseClient(connectionConfig, 'pg-transaction-test');
  
  try {
    // Create test table
    await client.query(`
      DROP TABLE IF EXISTS pg_transaction_test;
      CREATE TABLE pg_transaction_test (
        id SERIAL PRIMARY KEY,
        value INTEGER
      )
    `);
    
    // Test successful transaction
    const transaction = new TransactionHandler(client, { driver: 'postgre', level: 'RC' });
    await transaction.begin();
    
    await transaction.execute('INSERT INTO pg_transaction_test (value) VALUES ($1)', [100]);
    await transaction.execute('INSERT INTO pg_transaction_test (value) VALUES ($1)', [200]);
    
    await transaction.commit();
    
    const result = await client.query('SELECT * FROM pg_transaction_test');
    console.log('✓ Transaction commit successful, rows:', result.rows.length);
    
    // Test rollback
    const transaction2 = new TransactionHandler(client, { driver: 'postgre' });
    await transaction2.begin();
    
    await transaction2.execute('INSERT INTO pg_transaction_test (value) VALUES ($1)', [300]);
    
    await transaction2.rollback();
    
    const result2 = await client.query('SELECT * FROM pg_transaction_test');
    console.log('✓ Transaction rollback successful, rows still:', result2.rows.length);
    
    // Clean up
    await client.query('DROP TABLE pg_transaction_test');
    await client.end();
    
  } catch (err) {
    console.error('✗ Transaction test failed:', err.message);
    console.error(err.stack);
    await client.end();
    process.exit(1);
  }
}

async function testBuilder() {
  console.log('\nTesting PostgreBuilder...');
  
  try {
    // Test SELECT builder
    const selectBuilder = new PostgreBuilder({
      operator: 'select',
      tables: [{ table: 'users', alias: 'u' }],
      conditions: [{ key: 'u.id', opt: '=', value: 1 }],
      orders: [{ sortField: 'created_at', sortOrder: 'desc' }],
      groupField: [],
      having: [],
      pageLimit: 10,
      pageOffset: 0
    });
    console.log('✓ SELECT builder:', selectBuilder.sql);
    
    // Test INSERT builder
    const insertBuilder = new PostgreBuilder({
      operator: 'insert',
      tables: [{ table: 'users' }],
      conditions: [],
      orders: [],
      groupField: [],
      having: [],
      data: { name: 'test', email: 'test@test.com' }
    });
    console.log('✓ INSERT builder:', insertBuilder.sql);
    
    // Test UPDATE builder
    const updateBuilder = new PostgreBuilder({
      operator: 'update',
      tables: [{ table: 'users' }],
      conditions: [{ key: 'id', opt: '=', value: 1 }],
      orders: [],
      groupField: [],
      having: [],
      data: { name: 'updated' }
    });
    console.log('✓ UPDATE builder:', updateBuilder.sql);
    
    // Test DELETE builder
    const deleteBuilder = new PostgreBuilder({
      operator: 'delete',
      tables: [{ table: 'users' }],
      conditions: [{ key: 'id', opt: '=', value: 1 }],
      orders: [],
      groupField: [],
      having: []
    });
    console.log('✓ DELETE builder:', deleteBuilder.sql);
    
    console.log('✓ All builder tests passed');
    
  } catch (err) {
    console.error('✗ Builder test failed:', err.message);
    process.exit(1);
  }
}

async function testManageSQLBuilder() {
  console.log('\nTesting PostgreManageSQLBuilder...');
  
  try {
    // Test CREATE TABLE
    const createTableBuilder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'table',
      name: 'test_table',
      columns: {
        id: { type: 'int', primaryKey: true, autoIncrement: true },
        name: { type: 'varchar', length: 255 },
        email: { type: 'varchar', length: 255, uniqIndex: true }
      }
    });
    console.log('✓ CREATE TABLE:', createTableBuilder.sql);
    
    // Test CREATE INDEX
    const createIndexBuilder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'index',
      name: 'idx_test',
      table: 'test_table',
      columns: ['name']
    });
    console.log('✓ CREATE INDEX:', createIndexBuilder.sql);
    
    // Test DROP TABLE
    const dropTableBuilder = new PostgreManageSQLBuilder({
      operator: 'drop',
      target: 'table',
      name: 'test_table'
    });
    console.log('✓ DROP TABLE:', dropTableBuilder.sql);
    
    console.log('✓ All manage SQL builder tests passed');
    
  } catch (err) {
    console.error('✗ ManageSQLBuilder test failed:', err.message);
    process.exit(1);
  }
}

async function main() {
  console.log('=== PostgreSQL Feature Tests ===\n');
  
  await testBuilder();
  await testManageSQLBuilder();
  await testConnection();
  await testPool();
  await testPromiseClient();
  await testPostgreClient();
  await testTransaction();
  
  console.log('\n=== All PostgreSQL tests passed! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
