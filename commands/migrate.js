'use strict';

const path = require('path');
const { Command, printer, debug } = require('@axiosleo/cli-tool');
const { _list } = require('@axiosleo/cli-tool/src/helper/fs');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { createPromiseClient } = require('../src/client');
const { _caml_case, _render } = require('@axiosleo/cli-tool/src/helper/str');
const { _validate } = require('../src/utils');
const is = require('@axiosleo/cli-tool/src/helper/is');

let actions = {
  database: {
    create: 'CREATE DATABASE `${database_name}` CHARACTER SET ${charset} COLLATE ${collate}',
    drop: 'DROP DATABASE `${database_name}`',
  },
  table: {
    create: 'CREATE TABLE `${table_name}` (${columns}, PRIMARY KEY (`${primary_column}`)) ENGINE=${engine} DEFAULT CHARSET=utf8mb4',
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

class Migration {
  constructor(conn) {
    this.conn = conn;
  }
}

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
    if (column.not_null === true) {
      str += ' NOT NULL';
    }
    if (column.unsigned === true) {
      str += ' UNSIGNED';
    }
    if (typeof column.default !== 'undefined') {
      if (column.default === null) {
        str += ' DEFAULT NULL';
      } else if (is.string(column.default)) {
        str += ` DEFAULT '${column.default}'`;
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
    }
    return str;
  });
  if (primary_column) {
    strs.push(`PRIMARY KEY (\`${primary_column.name}\`)`);
    strs.push(`UNIQUE INDEX \`${primary_column.name}\` (\`${primary_column.name}\` ASC) VISIBLE`);
  }
  return strs.join(',');
}

class MigrateCommand extends Command {
  constructor() {
    super({
      name: 'migrate',
      desc: ''
    });
    this.addArgument('dir', 'migration directory', 'required');
    this.addArgument('action', 'up or down', 'optional', 'up');
    this.addOption('host', null, '[localhost] mysql host', 'optional', 'localhost');
    this.addOption('user', null, '[root] username for connect to the database', 'optional', 'root');
    this.addOption('pass', null, 'password to connect to the database', 'required');
    this.addOption('port', null, '[3306] port number to connect to the database', 'optional', 3306);
    this.addOption('db', null, 'database name', 'required');
    this.addOption('debug', 'd', '[false] debug mode', 'optional', false);

    this.queries = [];
  }

  /**
   * @param {*} args 
   * @param {*} options 
   */
  async exec(args, options) {
    const dir = path.resolve(process.cwd(), args.dir);
    const files = await _list(dir, false, '.js');
    const conn = await createPromiseClient({
      host: options.host,
      user: options.user,
      password: options.pass,
      port: options.port,
      database: options.db
    }, options.db + '-migrate');
    let migrationObjs = Object.keys(actions);
    await _foreach(files, async (file) => {
      const migrateScript = require(path.join(dir, file));
      const self = this;

      switch (args.action) {
        case 'up': {
          if (typeof migrateScript.up !== 'function') {
            printer.error(`Migration file "${file}" must have a function named up.`);
            process.exit(1);
          }
          let migrationUp = new Migration(conn);
          migrationObjs.forEach((obj) => {
            Object.defineProperty(migrationUp, 'create' + _caml_case(obj, true), {
              value: function (options) {
                self.create(obj, options, file);
              },
              writable: true,
              enumerable: true,
              configurable: true
            });
          });
          await migrateScript.up(migrationUp);
          break;
        }
        case 'down': {
          if (typeof migrateScript.down !== 'function') {
            printer.error(`Migration file "${file}" must have a function named down.`);
            process.exit(1);
          }
          let migrationDown = new Migration(conn);
          migrationObjs.forEach((obj) => {
            Object.defineProperties(migrationDown, {
              ['drop' + _caml_case(obj, true)]: (options) => {
                self.down(obj, options, file);
              }
            });
          });
          await migrateScript.down(migrationDown);
          break;
        }
        default: {
          throw new Error(`Unknown migration action ${args.action}.`);
        }
      }
    });

    debug.log(this.queries);
  }

  async create(obj, options = {}) {
    switch (obj) {
      case 'database': {
        __validate(options, {
          database_name: 'required|string'
        });
        let opt = {
          database_name: options.database_name,
          charset: options.charset || 'utf8mb4',
          collate: options.collate || 'utf8mb4_unicode_ci'
        };
        this.queries.push({
          sql: _render(actions.database.create, opt),
          value: []
        });
        break;
      }
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
        this.queries.push({
          sql: _render(actions.table.create, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.column.create, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.index.create, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.foreign_key.create, opt),
          value: []
        });
        break;
      }
      default:
        throw new Error(`Unknown migration object ${obj}.`);
    }
  }

  async drop(obj, options) {
    switch (obj) {
      case 'database': {
        __validate(options, {
          database_name: 'required|string'
        });
        let opt = {
          database_name: options.database_name
        };
        this.queries.push({
          sql: _render(actions.database.drop, opt),
          value: []
        });
        break;
      }
      case 'table': {
        __validate(options, {
          table_name: 'required|string'
        });
        let opt = {
          table_name: options.table_name
        };
        this.queries.push({
          sql: _render(actions.table.drop, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.column.drop, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.index.drop, opt),
          value: []
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
        this.queries.push({
          sql: _render(actions.foreign_key.drop, opt),
          value: []
        });
        break;
      }
      default:
        throw new Error(`Unknown migration object ${obj}.`);
    }
  }
}

module.exports = MigrateCommand;
