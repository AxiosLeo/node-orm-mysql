'use strict';

const os = require('os');
const path = require('path');
const { _list } = require('@axiosleo/cli-tool/src/helper/fs');
const { createClient, createPool } = require('./client');
const { QueryHandler } = require('./operator');
const { printer } = require('@axiosleo/cli-tool');
const { _execSQL, _validate } = require('./utils');
const { _render, _caml_case } = require('@axiosleo/cli-tool/src/helper/str');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');

const actions = {
  // database: {
  //   create: 'CREATE DATABASE `${database_name}` CHARACTER SET ${charset} COLLATE ${collate}',
  //   drop: 'DROP DATABASE `${database_name}`',
  // },
  table: {
    create: 'CREATE TABLE `${table_name}` (' + os.EOL +
      '${columns}' + os.EOL +
      ') ENGINE=${engine} DEFAULT CHARSET=utf8mb4',
    drop: 'DROP TABLE `${table_name}`',
  },
  column: {
    create: 'ALTER TABLE `${table_name}` ADD COLUMN',
    drop: 'ALTER TABLE `${table_name}` DROP COLUMN'
  },
  index: {
    create: 'CREATE INDEX `${index_name}` ON `${table_name}` (${column_names})',
    drop: 'DROP INDEX `${index_name}`'
  },
  foreign_key: {
    create: 'ALTER TABLE `${table_name}` ADD CONSTRAINT `${foreign_key_name}` FOREIGN KEY (`${column_name}`) REFERENCES `${foreign_table_name}` (`${foreign_column_name}`)',
    drop: 'ALTER TABLE `${table_name}` DROP FOREIGN KEY `${foreign_key_name}`'
  }
};

const migrationColumns = [
  {
    name: 'id',
    type: 'int',
    length: 11,
    not_null: true,
    auto_increment: true,
    is_primary_key: true,
  },
  {
    name: 'file',
    type: 'varchar',
    length: 255,
    not_null: true,
  },
  {
    name: 'migration_key',
    type: 'varchar',
    length: 255,
    not_null: true,
  },
  {
    name: 'sql',
    type: 'text',
    not_null: true,
  },
  {
    name: 'md5',
    type: 'text',
    not_null: true,
    is_uniq_index: true,
  },
  {
    name: 'created_at',
    type: 'datetime',
    not_null: true,
    default: 'timestamp',
  }
];

function __validate(obj, rules = {}) {
  try {
    _validate(obj, rules);
  } catch (e) {
    let tmp = e.stack.split('\n');
    let local = tmp[5].indexOf('at Object.jump') > -1 ? tmp[6] : tmp[5];
    printer.println().yellow(local.trim()).println().println().print('    ').red(e.message).println();
    process.exit(1);
  }
}

function _renderColumns(columns) {
  let primary_column = null;
  let indexs = [];
  let strs = columns.map(column => {
    __validate(column, {
      name: 'required|string',
      type: 'required|string',
      default: 'string',
      comment: 'string',
      not_null: 'boolean',
      auto_increment: 'boolean',
      collate: 'string',
    });
    let str = `\`${column.name}\` ${column.type.toUpperCase()}`;
    if (typeof column.length !== 'undefined') {
      str += `(${column.length})`;
    }
    if (column.not_null === true) {
      str += ' NOT NULL';
    }
    if (column.unsigned === true) {
      str += ' UNSIGNED';
    }
    if (typeof column.default !== 'undefined') {
      if (column.default === null) {
        str += ' DEFAULT NULL';
      } else if (column.default === 'timestamp') {
        str += ' DEFAULT CURRENT_TIMESTAMP';
      } else if (is.string(column.default)) {
        str += ` DEFAULT ${column.default}`;
      }
    }
    if (is.string(column.comment) && is.empty(column.comment) === false) {
      str += ` COMMENT '${column.comment}'`;
    }
    if (column.auto_increment === true) {
      str += ' AUTO_INCREMENT';
    }
    if (column.is_primary_key === true) {
      primary_column = column;
    } else if (column.is_uniq_index === true) {
      indexs.push(column);
    }
    return str;
  });
  if (primary_column) {
    strs.push(`PRIMARY KEY (\`${primary_column.name}\`)`);
    strs.push(`UNIQUE INDEX \`${primary_column.name}\` (\`${primary_column.name}\` ASC) VISIBLE`);
  }
  if (indexs.length > 0) {
    indexs.forEach((i) => {
      strs.push(`UNIQUE INDEX \`${i.name}\` (\`${i.name}\` ASC) VISIBLE`);
    });
  }
  return strs.join(',' + os.EOL);
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function init(context) {
  let files = await _list(context.config.dir, false, '.js');
  if (context.action === 'down') {
    files = files.reverse();
  }

  context.files = files;
  context.items = Object.keys(actions);

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
    return;
  }

  // migration table not exists
  printer.yellow('will create table ' + context.task_key).println();
  let res = await _execSQL(conn, _render(actions.table.create, {
    table_name: context.task_key,
    columns: _renderColumns(migrationColumns),
    engine: 'InnoDB',
  }));
  if (res.serverStatus !== 2) {
    printer.error('create migration table failed.');
    process.exit(1);
  }
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function _create(context, item, options) {
  switch (item) {
    case 'table': {
      __validate(options, {
        table_name: 'required|string',
        columns: 'required|array',
        primary_column: 'string',
        engine: 'string',
      });
      if (!options.columns.find(c => c.is_primary_key === true)) {
        throw new Error('Primary key is required.');
      }
      let opt = {
        table_name: options.table_name,
        columns: _renderColumns(options.columns),
        primary_column: options.primary_column || 'id',
        engine: options.engine || 'InnoDB',
      };
      context.runtime.queries.push({
        sql: _render(actions.table.create, opt),
        value: [],
      });
      break;
    }
    case 'column': {
      __validate(options, {
        table_name: 'required|string',
        column_name: 'required|string',
        column_type: 'required|string',
        column_length: 'integer',
        column_default: 'string',
        column_comment: 'string',
        column_nullable: 'string',
        column_auto_increment: 'string',
      });
      let opt = {
        table_name: options.table_name,
        column_name: options.column_name,
        column_type: options.column_type,
        column_length: options.column_length || null,
        column_default: options.column_default || null,
        column_comment: options.column_comment || null,
        column_nullable: options.column_nullable || 'NOT NULL',
        column_auto_increment: options.column_auto_increment || null,
      };
      context.runtime.queries.push({
        sql: _render(actions.column.create, opt),
        value: [],
      });
      break;
    }
    case 'index': {
      __validate(options, {
        table_name: 'required|string',
        index_name: 'required|string',
        column_names: 'required|array',
      });
      let opt = {
        table_name: options.table_name,
        index_name: options.index_name,
        column_names: options.column_names,
      };
      context.runtime.queries.push({
        sql: _render(actions.index.create, opt),
        value: [],
      });
      break;
    }
    case 'foreign_key': {
      __validate(options, {
        table_name: 'required|string',
        foreign_key_name: 'required|string',
        column_name: 'required|string',
        foreign_table_name: 'required|string',
        foreign_column_name: 'required|string',
      });
      let opt = {
        table_name: options.table_name,
        foreign_key_name: options.foreign_key_name,
        column_name: options.column_name,
        foreign_table_name: options.foreign_table_name,
        foreign_column_name: options.foreign_column_name,
      };
      context.runtime.queries.push({
        sql: _render(actions.foreign_key.create, opt),
        value: [],
      });
      break;
    }
    default:
      throw new Error(`Unknown migration operation create${_caml_case(item, true)}.`);
  }
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function _drop(context, item, options) {
  switch (item) {
    case 'table': {
      __validate(options, {
        table_name: 'required|string'
      });
      let opt = {
        table_name: options.table_name
      };
      context.runtime.queries.push({
        sql: _render(actions.table.drop, opt),
        value: [],
      });
      break;
    }
    case 'column': {
      __validate(options, {
        table_name: 'required|string',
        column_name: 'required|string'
      });
      let opt = {
        table_name: options.table_name,
        column_name: options.column_name
      };
      context.runtime.queries.push({
        sql: _render(actions.column.drop, opt),
        value: [],
      });
      break;
    }
    case 'index': {
      __validate(options, {
        table_name: 'required|string',
        index_name: 'required|string'
      });
      let opt = {
        table_name: options.table_name,
        index_name: options.index_name
      };
      context.runtime.queries.push({
        sql: _render(actions.index.drop, opt),
        value: [],
      });
      break;
    }
    case 'foreign_key': {
      __validate(options, {
        table_name: 'required|string',
        foreign_key_name: 'required|string'
      });
      let opt = {
        table_name: options.table_name,
        foreign_key_name: options.foreign_key_name
      };
      context.runtime.queries.push({
        sql: _render(actions.foreign_key.drop, opt),
        value: [],
      });
      break;
    }
    default:
      throw new Error(`Unknown migration operation drop${_caml_case(item, true)}.`);
  }
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function _build(context, file) {
  const script = require(context.runtime.script);

  const migration = {};

  context.items.forEach((item) => {
    Object.defineProperty(migration, 'create' + _caml_case(item, true), {
      value: function (options) {
        _create.call(this, context, item, options);
      },
      writable: true,
      enumerable: true,
      configurable: true
    });
    Object.defineProperties(migration, 'drop' + _caml_case(item, true), {
      value: function (options) {
        _drop.call(this, context, item, options);
      },
      writable: true,
      enumerable: true,
      configurable: true
    });
  });

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
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function _exec(context, file) {
  // const queries = context.runtime.queries;
}

/**
 * initialize migration
 * @param {import('./migration').Context} context 
 */
async function run(context) {
  const { files, config } = context;
  await _foreach(files, async (file) => {
    context.runtime.script = path.join(config.dir, file);
    context.runtime.queries = [];
    await _build(context, file);
    await _exec(context, file);
  });
}

async function end(context) {

}

module.exports = {
  init,
  run,
  end
};
