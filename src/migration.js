'use strict';

const path = require('path');
const { _list, _exists } = require('@axiosleo/cli-tool/src/helper/fs');
const { createClient, createPool, createPromiseClient } = require('./client');
const { QueryHandler } = require('./operator');
const { printer, debug } = require('@axiosleo/cli-tool');
const { _execSQL } = require('./core');
const { _render } = require('@axiosleo/cli-tool/src/helper/str');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const { TransactionHandler } = require('..');
const { ManageSQLBuilder } = require('./builder');

const migrationColumns = [
  {
    name: 'id',
    type: 'int',
    length: 11,
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
    type: 'datetime',
    allowNull: false,
    default: 'timestamp',
  }
];

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function init(context) {
  let files = await _list(context.config.dir, false, '.js');
  if (context.action === 'down') {
    files = files.reverse();
  }
  context.files = files.filter(f => f !== '.connect.js');

  const connectPath = path.join(context.config.dir, '.connect.js');
  if (await _exists(connectPath)) {
    const connect = require(connectPath);
    _assign(context.connection, connect);
  }
  if (!context.task_key) {
    context.task_key = 'migrate_' + context.connection.database;
  }
  let globalConn = createClient({
    ...context.connection,
    database: 'mysql'
  });
  let handler = new QueryHandler(globalConn);

  const database = context.connection.database;
  if (!await handler.existDatabase(database)) {
    printer.yellow('will create database ' + database).println().println();
    await _execSQL(globalConn, _render('CREATE DATABASE `${database_name}` CHARACTER SET ${charset} COLLATE ${collate}', {
      database_name: database,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }));
  }
  globalConn.end();
  const conn = createPool(context.connection, context.task_key);
  context.pool = conn;

  handler = new QueryHandler(conn);
  if (await handler.existTable(context.task_key, database)) {
    conn.end();
    return;
  }

  // migration table not exists
  printer.yellow('will create table ' + context.task_key).println();
  let builder = new ManageSQLBuilder({
    operator: 'create',
    target: 'table',
    name: context.task_key,
    columns: migrationColumns
  });
  let res = await _execSQL(conn, builder.sql);
  conn.end();
  if (res.serverStatus !== 2 && res.serverStatus !== 16386) {
    printer.error('create migration table failed.');
    process.exit(1);
  }
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function _exec(context, queries) {
  const conn = await createPromiseClient(context.connection, context.task_key + '_transaction');
  const transaction = new TransactionHandler(conn);
  await transaction.begin();

  try {
    const files = Object.keys(queries);
    await _foreach(files, async (file) => {
      const hasMigrated = await transaction.table(context.task_key)
        .where('migration_key', context.task_key)
        .where('filename', file)
        .count();
      if (context.action === 'up' && hasMigrated) {
        if (hasMigrated) {
          printer.yellow(`Migration file "${file}" has been migrated.`).println();
          return;
        }
      } else if (context.action === 'down' && !hasMigrated) {
        return;
      }

      const sqls = queries[file];
      await _foreach(sqls, async (query) => {
        if (context.debug) {
          debug.log(query.sql);
        }
        await transaction.query(query);
      });

      if (context.action === 'up') {
        await transaction.table(context.task_key).insert({
          migration_key: context.task_key,
          filename: file,
          created_at: new Date()
        });
        printer.green('Success migrate up: ').yellow(file).println(' ');
      } else {
        const item = await transaction.table(context.task_key)
          .where('migration_key', context.task_key)
          .where('filename', file).find();
        if (item) {
          await transaction.table(context.task_key).where('id', item.id).delete();
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
      const builder = new ManageSQLBuilder(options);
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
      const builder = new ManageSQLBuilder(options);
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
      const builder = new ManageSQLBuilder(options);
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
      const builder = new ManageSQLBuilder(options);
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropTable', {
    value: function (table) {
      const builder = new ManageSQLBuilder({
        operator: 'drop',
        target: 'table',
        name: table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropColumn', {
    value: function (name, table) {
      const builder = new ManageSQLBuilder({
        operator: 'drop',
        target: 'column',
        name,
        table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropIndex', {
    value: function (name, table) {
      const builder = new ManageSQLBuilder({
        operator: 'drop',
        target: 'index',
        name,
        table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  Object.defineProperty(migration, 'dropForeignKey', {
    value: function (name, table) {
      const builder = new ManageSQLBuilder({
        operator: 'drop',
        target: 'foreignKey',
        name,
        table
      });
      queries[file].push({ sql: builder.sql, values: builder.values });
    }, ...baseAttr
  });

  return migration;
}

/**
 * initialize migration
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
  end
};
