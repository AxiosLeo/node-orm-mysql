'use strict';

// eslint-disable-next-line no-unused-vars
const mysql = require('mysql2/promise');
const { QueryOperator } = require('./operator');
const { _query } = require('./core');

const levels = {
  RU: 'READ UNCOMMITTED',
  RC: 'READ COMMITTED',
  RR: 'REPEATABLE READ',
  S: 'SERIALIZABLE'
};

class TransactionOperator extends QueryOperator {
  /**
   * @param {*} conn 
   */
  constructor(conn, options) {
    super(conn);
    this.options.transaction = true;
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
   * @example LOCK IN SHARE MODE
   * @example FOR UPDATE
   */
  append(suffix) {
    this.options.suffix = suffix || null;
    return this;
  }
}

class TransactionHandler {
  /**
   * @param {mysql.Connection} conn 
   * @param {mysql.ConnectionOptions} options
   */
  constructor(conn, options = {}) {
    this.isbegin = false;
    this.conn = conn;
    this.level = options.level || 'SERIALIZABLE';
    if (levels[this.level]) {
      this.level = levels[this.level];
    }
    this.options = options;
    if (!Object.values(levels).includes(this.level)) {
      throw new Error('Invalid transaction level: ' + this.level);
    }
  }

  async query(options) {
    return new Promise((resolve, reject) => {
      _query(this.conn, { transaction: true, driver: 'mysql' }, options)
        .catch((res) => reject(res))
        .then((res) => resolve(res));
    });
  }

  async execute(sql, values = []) {
    return this.conn.execute(sql, values);
  }

  async lastInsertId(alias = 'insert_id') {
    let sql = `SELECT LAST_INSERT_ID() as ${alias}`;
    const [row] = await this.execute(sql);
    return row && row[0] ? row[0][alias] : 0;
  }

  async begin() {
    this.isbegin = true;
    await this.execute(`SET TRANSACTION ISOLATION LEVEL ${this.level}`);
    await this.conn.beginTransaction();
  }

  table(table, alias = null) {
    if (!this.isbegin) {
      throw new Error('Transaction is not begin');
    }
    return (new TransactionOperator(this.conn, this.options)).table(table, alias);
  }

  async upsert(tableName, data, condition = {}) {
    const count = await this.table(tableName).whereObject(condition).count();
    if (count) {
      return await this.table(tableName).whereObject(condition).update(data);
    }
    return await this.table(tableName).insert(data);
  }

  async commit() {
    if (!this.isbegin) {
      throw new Error('Transaction is not begin');
    }
    await this.conn.commit();
  }

  async rollback() {
    if (!this.isbegin) {
      throw new Error('Transaction is not begin');
    }
    await this.conn.rollback();
  }
}

module.exports = {
  TransactionOperator,
  TransactionHandler
};
