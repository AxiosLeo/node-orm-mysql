'use strict';

const path = require('path');
const { _list, _exists } = require('@axiosleo/cli-tool/src/helper/fs');
const { createClient, createPool, createPromiseClient } = require('./client');
const { printer, debug } = require('@axiosleo/cli-tool');
const { _render } = require('@axiosleo/cli-tool/src/helper/str');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const { TransactionHandler } = require('./transaction');
const { PostgreManageSQLBuilder, PostgreBuilder } = require('./postgre-builder');

const migrationColumns = [
  {
    name: 'id',
    type: 'int',
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  },
  {
    name: 'migration_key',
    type: 'varchar',
    length: 255,
    allowNull: false,
  },
  {
    name: 'filename',
    type: 'varchar',
    length: 255,
    allowNull: false,
    uniqIndex: true,
  },
  {
    name: 'created_at',
    type: 'timestamp',
    allowNull: false,
    default: 'CURRENT_TIMESTAMP',
  }
];

/**
 * initialize migration for PostgreSQL
 * @param {import('./migration').Context} context 
 */
async function init(context) {
  let files = await _list(context.config.dir, false, '.js');
  if (context.action === 'down') {
    files = files.reverse();
  }
  context.files = files.filter(f => f !== '.connect.js');
  context.config.dir = path.resolve(context.config.dir);
  const connectPath = path.join(context.config.dir, '.connect.js');
  if (await _exists(connectPath)) {
    const connect = require(connectPath);
    _assign(context.connection, connect);
  }
  
  // Ensure driver is set to postgre
  context.connection.driver = 'postgre';
  
  if (!context.task_key) {
    context.task_key = 'migrate_' + context.connection.database;
  }
  
  // Connect to postgres database to check/create target database
  let globalConn = createClient({
    ...context.connection,
    database: 'postgres',
    driver: 'postgre'
  });
  
  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 100));

  const database = context.connection.database;
  
  // Check if database exists
  const dbCheckResult = await globalConn.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database]
  );
  
  if (dbCheckResult.rows.length === 0) {
    printer.yellow('will create database ' + database).println().println();
    await globalConn.query(_render('CREATE DATABASE "${database_name}"', {
      database_name: database
    }));
  }
  await globalConn.end();
  
  const conn = createPool({ ...context.connection, driver: 'postgre' }, context.task_key);
  context.pool = conn;

  // Check if migration table exists
  const tableCheckResult = await conn.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    )`,
    [context.task_key]
  );
  
  if (tableCheckResult.rows[0].exists) {
    await conn.end();
    return;
  }

  // Create migration table
  printer.yellow('will create table ' + context.task_key).println();
  
  // Build columns for migration table
  const columnsObj = {};
  migrationColumns.forEach(col => {
    columnsObj[col.name] = col;
  });
  
  let builder = new PostgreManageSQLBuilder({
    operator: 'create',
    target: 'table',
    name: context.task_key,
    columns: columnsObj
  });
  
  await conn.query(builder.sql);
  await conn.end();
}

/**
 * Execute migration queries for PostgreSQL
 * @param {import('./migration').Context} context 
 */
async function _exec(context, queries) {
  const conn = await createPromiseClient({ ...context.connection, driver: 'postgre' }, context.task_key + '_transaction');
  const transaction = new TransactionHandler(conn, { driver: 'postgre' });
  await transaction.begin();

  try {
    const files = Object.keys(queries);
    await _foreach(files, async (file) => {
      // Check if already migrated
      const countResult = await conn.query(
        `SELECT COUNT(*) as count FROM "${context.task_key}" WHERE migration_key = $1 AND filename = $2`,
        [context.task_key, file]
      );
      const hasMigrated = parseInt(countResult.rows[0].count) > 0;
      
      if (context.action === 'up' && hasMigrated) {
        printer.yellow(`Migration file "${file}" has been migrated.`).println();
        return;
      } else if (context.action === 'down' && !hasMigrated) {
        return;
      }

      const sqls = queries[file];
      await _foreach(sqls, async (query) => {
        if (context.debug) {
          debug.log(query.sql);
        }
        await conn.query(query.sql, query.values || []);
      });

      if (context.action === 'up') {
        await conn.query(
          `INSERT INTO "${context.task_key}" (migration_key, filename, created_at) VALUES ($1, $2, $3)`,
          [context.task_key, file, new Date()]
        );
        printer.green('Success migrate up: ').yellow(file).println(' ');
      } else {
        // Find and delete migration record
        const itemResult = await conn.query(
          `SELECT id FROM "${context.task_key}" WHERE migration_key = $1 AND filename = $2`,
          [context.task_key, file]
        );
        if (itemResult.rows.length > 0) {
          await conn.query(
            `DELETE FROM "${context.task_key}" WHERE id = $1`,
            [itemResult.rows[0].id]
          );
        }
        printer.green('Success migrate down: ').yellow(file).println(' ');
      }
    });
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    debug.log(e);
  }
}

function _initMigration(file, queries = {}) {
  const migration = {};
  let baseAttr = {
    writable: true,
    enumerable: true,
    configurable: true
  };
  
  Object.defineProperty(migration, 'createTable', {
    value: function (table, columns, options = {}) {
      _assign(options, {
        operator: 'create',
        target: 'table',
        name: table,
        columns
      });
      const builder = new PostgreManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'createColumn', {
    value: function (name, type, table, options = {}) {
      _assign(options, {
        operator: 'create',
        target: 'column',
        table,
        name,
        type
      });
      const builder = new PostgreManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'addColumn', {
    value: function (tableName, columnName, options = {}) {
      _assign(options, {
        operator: 'create',
        target: 'column',
        table: tableName,
        name: columnName
      });
      const builder = new PostgreManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'createIndex', {
    value: function (table, columns, options = {}) {
      _assign(options, {
        operator: 'create',
        target: 'index',
        name: options.indexName ? options.indexName : 'idx_' + table + '_' + columns.join('_'),
        table,
        columns
      });
      const builder = new PostgreManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'createForeignKey', {
    value: function (options = {}) {
      _assign(options, {
        operator: 'create',
        target: 'foreignKey',
        name: options.foreignKey ? options.foreignKey : 'fk_' + options.tableName + '_' + options.columnName,
        table: options.tableName,
        column: options.columnName,
        reference: options.reference
      });
      const builder = new PostgreManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropTable', {
    value: function (table) {
      const builder = new PostgreManageSQLBuilder({
        operator: 'drop',
        target: 'table',
        name: table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropColumn', {
    value: function (name, table) {
      const builder = new PostgreManageSQLBuilder({
        operator: 'drop',
        target: 'column',
        name,
        table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropIndex', {
    value: function (name) {
      const builder = new PostgreManageSQLBuilder({
        operator: 'drop',
        target: 'index',
        name
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropForeignKey', {
    value: function (name, table) {
      const builder = new PostgreManageSQLBuilder({
        operator: 'drop',
        target: 'foreignKey',
        name,
        table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'insertData', {
    value: function (table, data) {
      const builder = new PostgreBuilder({
        operator: 'insert',
        tables: [{ table }],
        data
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'raw', {
    value: function (sql, values) {
      queries[file].push({ sql, values });
    }, ...baseAttr
  });

  return migration;
}

/**
 * Run migration for PostgreSQL
 * @param {import('./migration').Context} context 
 */
async function run(context) {
  const { files } = context;
  const queries = {};
  await _foreach(files, async (file) => {
    const scriptPath = path.join(context.config.dir, file);
    const script = require(scriptPath);
    queries[file] = [];

    const migration = _initMigration(file, queries);

    switch (context.action) {
      case 'up': {
        if (typeof script.up !== 'function') {
          printer.error(`Migration file "${file}" must have a function named up.`);
          process.exit(1);
        }
        await script.up(migration);
        break;
      }
      case 'down': {
        if (typeof script.down !== 'function') {
          printer.error(`Migration file "${file}" must have a function named down.`);
          process.exit(1);
        }
        await script.down(migration);
        break;
      }
      default: {
        throw new Error(`Unknown migration action ${context.action}.`);
      }
    }
  });
  await _exec(context, queries);
}

async function end(context) {
  printer.yellow('Done').println(' ');
}

module.exports = {
  init,
  run,
  _initMigration,
  end
};
