'use strict';

const os = require('os');
const { Builder } = require('./builder');
const { Query, QueryCondition } = require('./query');
const Hook = require('./hook');
const { _query } = require('./core');
const { printer } = require('@axiosleo/cli-tool');
const is = require('@axiosleo/cli-tool/src/helper/is');

class QueryOperator extends Query {
  /**
   * @param {*} conn 
   */
  constructor(conn = null, options = {}) {
    super(null);
    this.conn = conn;
    this.options.driver = options.driver || 'mysql';
    this.options.queryHandler = options.queryHandler || null;
    if (this.options.driver !== 'mysql') {
      if (!this.options.queryHandler) {
        throw new Error('queryHandler is required');
      }
      if (!(this.options.queryHandler instanceof Function)) {
        throw new Error('queryHandler must be a function');
      }
    }
  }

  /**
   * @deprecated use QueryOperator.notExec() instead
   * @param {*} operator 
   * @returns 
   */
  buildSql(operator) {
    this.options.operator = operator;
    this.options.notExec = true;
    return new Builder(this.options);
  }

  async explain(operator) {
    this.options.operator = operator;
    this.options.explain = true;
    this.options.notExec = false;
    return await this.exec();
  }

  async exec() {
    if (this.options.notExec === true) {
      return new Builder(this.options);
    }
    if (!this.options.operator) {
      throw new Error('Invalid operator: ' + this.options.operator);
    }
    if (this.conn === null) {
      throw new Error('Connection is null');
    }
    const from = this.options.tables.map(t => t.table).join(',');
    Hook.listen({ label: 'pre', table: from, opt: this.options.operator }, this.options, this.conn);
    let res;
    try {
      switch (this.options.operator) {
        case 'find': {
          const tmp = await _query(this.conn, this.options);
          res = tmp[0];
          break;
        }
        case 'count': {
          const [tmp] = await _query(this.conn, this.options);
          res = tmp.count;
          break;
        }
        default:
          res = await _query(this.conn, this.options);
      }
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, res, this.conn);
    } catch (err) {
      const e = new Error();
      let f = e.stack.split(os.EOL).find(s =>
        !s.startsWith('Error') &&
        s.indexOf('QueryOperator') < 0 &&
        s.indexOf('node:internal') < 0
      );
      if (f) {
        printer.println();
        printer.print('[MySQL] error  : '.data).print(f.trim().warning).println();
        printer.print('[MySQL] message: '.data).print(err.message.error).println();
        printer.print('[MySQL] query  : '.data).print(err.sql).println().println();
      }
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, err, this.conn);
      throw err;
    }
    return res;
  }

  async select(...attrs) {
    if (attrs.length > 0) {
      this.options.attrs = attrs;
    }
    this.options.operator = 'select';
    return await this.exec();
  }

  async find() {
    this.options.operator = 'find';
    return await this.exec();
  }

  async update(data) {
    this.options.operator = 'update';
    if (data) {
      this.set(data);
    }
    return await this.exec();
  }

  async insert(data, keys = null) {
    if (keys) {
      this.options.onDuplicateKeys = keys;
    }
    this.options.operator = 'insert';
    if (!is.empty(data)) {
      this.set(data);
    }
    if (!is.object(this.options.data)) {
      throw new Error('data must be an object');
    }
    return await this.exec();
  }

  async insertAll(rows = []) {
    this.options.operator = 'insert';
    if (rows.length) {
      this.options.data = rows;
    }
    if (!is.array(this.options.data)) {
      throw new Error('data must be an array');
    }
    return await this.exec();
  }

  async count() {
    this.options.operator = 'count';
    return await this.exec();
  }

  /**
   * increment a column value
   * @param {string} attr 
   * @param {string | number, callback?: Callback} increment 
   * @returns 
   */
  async incrBy(attr, increment = 1) {
    this.options.attrs = [attr];
    this.options.operator = 'incrBy';
    this.options.increment = increment;
    return await this.exec();
  }

  async delete(id, index_field_name = 'id') {
    if (id) {
      this.where(index_field_name, id);
    }
    this.options.operator = 'delete';
    return await this.exec();
  }

  async upsertRow(data, condition) {
    if (!this.options.tables[0]) {
      throw new Error('table is required');
    }
    const query = new QueryOperator(this.conn, this.options);
    const table = this.options.tables[0].table;
    const alias = this.options.tables[0].alias;
    const q = query.table(table, alias);
    if (condition instanceof QueryCondition) {
      q.whereCondition(condition);
    } else {
      q.whereObject(condition);
    }
    const count = await q.count();
    if (count) {
      return await q.update(data);
    }
    return await query.insert(data);
  }

  notExec() {
    this.options.notExec = true;
    return this;
  }
}

class QueryHandler {
  constructor(conn, options = {}) {
    this.conn = conn;
    this.options = options;
  }

  /**
   * 
   * @param {import('mysql2').QueryOptions} opt 
   * @returns 
   */
  async query(opt) {
    if (!opt) {
      throw new Error('opt is required');
    }
    return await _query(this.conn, this.options, opt);
  }

  table(table, alias = null) {
    return (new QueryOperator(this.conn, this.options)).table(table, alias);
  }

  tables(...tables) {
    const operator = new QueryOperator(this.conn, this.options);
    return operator.tables(...tables);
  }

  /**
   * @deprecated
   * @param {*} table
   * @param {*} data 
   * @param {*} condition 
   * @returns 
   */
  async upsert(table, data, condition = {}) {
    const count = await this.table(table).whereObject(condition).count();
    if (count) {
      return await this.table(table).whereObject(condition).update(data);
    }
    return await this.table(table).insert(data);
  }

  async existTable(table, database = null) {
    if (!table) {
      throw new Error('table name is required');
    }
    const query = new QueryOperator(this.conn, this.options);
    const c = await query.table('information_schema.TABLES')
      .where('TABLE_SCHEMA', database || this.database)
      .where('TABLE_NAME', table)
      .count();
    return !!c;
  }

  async existDatabase(database) {
    const query = new QueryOperator(this.conn, this.options);
    const c = await query.table('information_schema.SCHEMATA')
      .where('SCHEMA_NAME', database)
      .count();
    return !!c;
  }

  async getTableFields(database, table, ...attrs) {
    return await this.query({
      sql: `SELECT ${attrs.length ? '*' : attrs.join(',')} FROM information_schema.columns WHERE table_schema=? AND table_name=?`,
      values: [database, table]
    });
  }

  /**
   * Begin a transaction and return a TransactionHandler instance
   * 
   * Note: If using a Pool, this will automatically get a new connection from the pool
   * to avoid blocking other operations. The connection will be released back to pool
   * after commit/rollback.
   * 
   * @param {object} options - Transaction options
   * @param {string} options.level - Transaction isolation level (RU, RC, RR, S or full name)
   * @param {boolean} options.useNewConnection - Force create new connection from pool (default: true for Pool, false for Connection)
   * @returns {Promise<import('./transaction').TransactionHandler>}
   */
  async beginTransaction(options = {}) {
    const { TransactionHandler } = require('./transaction');
    const transactionOptions = {
      ...this.options,
      level: options.level || 'SERIALIZABLE'
    };

    let conn = this.conn;
    let isPoolConnection = false;

    // Check if this.conn is a Pool
    if (this.conn && typeof this.conn.getConnection === 'function') {
      // This is a Pool, get a new connection from pool for transaction
      const useNewConnection = options.useNewConnection !== false; // default true for pool
      if (useNewConnection) {
        // Detect pool type by checking constructor name or promise() method
        // Callback pool (mysql2): has promise() method, constructor name is "Pool"
        // Promise pool (mysql2/promise): no promise() method, constructor name is "PromisePool"
        const isCallbackPool = typeof this.conn.promise === 'function';

        if (isCallbackPool) {
          // Callback-based pool (mysql2) - need to wrap getConnection in Promise
          conn = await new Promise((resolve, reject) => {
            this.conn.getConnection((err, connection) => {
              if (err) {
                reject(err);
              } else {
                resolve(connection);
              }
            });
          });
          // Convert callback connection to promise-based
          if (conn && typeof conn.promise === 'function') {
            conn = conn.promise();
          }
        } else {
          // Promise-based pool (mysql2/promise) - getConnection() already returns a Promise
          conn = await this.conn.getConnection();
        }
        isPoolConnection = true;
      }
    } else if (this.conn && typeof this.conn.promise === 'function') {
      // This is a mysql2 Connection, convert to promise-based
      conn = this.conn.promise();
    }

    const transaction = new TransactionHandler(conn, transactionOptions);

    // Store pool connection flag for cleanup
    if (isPoolConnection) {
      transaction._poolConnection = conn;
      transaction._originalCommit = transaction.commit.bind(transaction);
      transaction._originalRollback = transaction.rollback.bind(transaction);

      // Override commit to release connection back to pool
      transaction.commit = async function () {
        try {
          await this._originalCommit();
        } finally {
          if (this._poolConnection && typeof this._poolConnection.release === 'function') {
            this._poolConnection.release();
          }
        }
      };

      // Override rollback to release connection back to pool
      transaction.rollback = async function () {
        try {
          await this._originalRollback();
        } finally {
          if (this._poolConnection && typeof this._poolConnection.release === 'function') {
            this._poolConnection.release();
          }
        }
      };
    }

    await transaction.begin();
    return transaction;
  }

  /**
   * Commit current connection transaction (if using promise connection directly)
   */
  async commit() {
    if (this.conn && typeof this.conn.commit === 'function') {
      await this.conn.commit();
    } else {
      throw new Error('Connection does not support commit operation');
    }
  }

  /**
   * Rollback current connection transaction (if using promise connection directly)
   */
  async rollback() {
    if (this.conn && typeof this.conn.rollback === 'function') {
      await this.conn.rollback();
    } else {
      throw new Error('Connection does not support rollback operation');
    }
  }
}

module.exports = {
  QueryOperator,
  QueryHandler,
  QueryCondition,
  Query
};
