/* eslint-disable no-console */
'use strict';

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

async function setupTestDatabase() {
  console.log('=== Setting up feature test database ===\n');

  // Configuration from environment variables
  const config = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASS || '3AQqZTfmww=Ftj',
    multipleStatements: true
  };

  console.log('Connection config:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Database: ${process.env.MYSQL_DB || 'feature_tests'}\n`);

  let connection;

  try {
    // Connect to MySQL with retry
    console.log('Connecting to MySQL...');
    let retries = 5;
    while (retries > 0) {
      try {
        connection = await mysql.createConnection(config);
        console.log('✓ Connected successfully\n');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`Connection failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Read SQL file
    const sqlFile = path.join(__dirname, 'init-feature-tables.sql');
    console.log(`Reading SQL file: ${sqlFile}`);
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found: ${sqlFile}`);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('✓ SQL file read successfully\n');

    // Execute SQL
    console.log('Executing SQL statements...');
    await connection.query(sql);
    console.log('✓ Database and tables created successfully\n');

    // Verify tables
    console.log('Verifying table structure...');
    const [tables] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [process.env.MYSQL_DB || 'feature_tests']
    );

    console.log('\nCreated tables:');
    tables.forEach(row => {
      console.log(`  - ${row.TABLE_NAME}`);
    });

    // Verify data
    console.log('\nVerifying test data...');
    await connection.query(`USE ${process.env.MYSQL_DB || 'feature_tests'}`);
    
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
    const [accounts] = await connection.query('SELECT COUNT(*) as count FROM accounts');

    console.log(`  users table: ${users[0].count} records`);
    console.log(`  products table: ${products[0].count} records`);
    console.log(`  accounts table: ${accounts[0].count} records`);

    console.log('\n=== Database setup completed ===\n');
    console.log('✓ All test data is ready!');
    console.log('✓ You can now run feature tests\n');

  } catch (err) {
    console.error('\n✗ Error:', err.message);
    console.error('Details:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  setupTestDatabase().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { setupTestDatabase };

