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

// PostgreSQL isolation levels mapping
const pgLevels = {
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
    // Support both mysql and postgre without requiring custom queryHandler
    if (this.options.driver !== 'mysql' && this.options.driver !== 'postgre') {
      if (!this.options.queryHandler) {
        throw new Error('queryHandler is required');
      }
      if (!(this.options.queryHandler instanceof Function)) {
        throw new Error('queryHandler must be a function');
      }
    }
  }

  /**
   * @example LOCK IN SHARE MODE (MySQL)
   * @example FOR UPDATE
   * @example FOR SHARE (PostgreSQL)
   */
  append(suffix) {
    this.options.suffix = suffix || null;
    return this;
  }
}

class TransactionHandler {
  /**
   * @param {mysql.Connection | import('pg').PoolClient} conn 
   * @param {Object} options
   */
  constructor(conn, options = {}) {
    this.isbegin = false;
    this.conn = conn;
    this.driver = options.driver || 'mysql';
    this.level = options.level || 'SERIALIZABLE';
    
    const levelMap = this.driver === 'postgre' ? pgLevels : levels;
    if (levelMap[this.level]) {
      this.level = levelMap[this.level];
    }
    this.options = { ...options, driver: this.driver };
    if (!Object.values(levelMap).includes(this.level)) {
      throw new Error('Invalid transaction level: ' + this.level);
    }
  }

  async query(options) {
    const driver = this.driver;
    if (driver === 'postgre') {
      // PostgreSQL query
      const result = await this.conn.query(options.sql || options.text, options.values || []);
      return result.rows;
    }
    // MySQL query
    return new Promise((resolve, reject) => {
      _query(this.conn, { transaction: true, driver: 'mysql' }, options)
        .catch((res) => reject(res))
        .then((res) => resolve(res));
    });
  }

  async execute(sql, values = []) {
    if (this.driver === 'postgre') {
      // PostgreSQL uses query method
      const result = await this.conn.query(sql, values);
      return [result.rows, result];
    }
    // MySQL
    return this.conn.execute(sql, values);
  }

  /**
   * Get last insert ID
   * Note: For PostgreSQL, use RETURNING clause in INSERT statement instead
   * @param {string} alias 
   */
  async lastInsertId(alias = 'insert_id') {
    if (this.driver === 'postgre') {
      // PostgreSQL doesn't have LAST_INSERT_ID()
      // Use RETURNING clause in INSERT statement or currval()
      // This method is kept for compatibility but may not work as expected
      throw new Error('PostgreSQL does not support LAST_INSERT_ID(). Use RETURNING clause in INSERT statement.');
    }
    let sql = `SELECT LAST_INSERT_ID() as ${alias}`;
    const [row] = await this.execute(sql);
    return row && row[0] ? row[0][alias] : 0;
  }

  async begin() {
    this.isbegin = true;
    if (this.driver === 'postgre') {
      // PostgreSQL transaction
      await this.conn.query('BEGIN');
      await this.conn.query(`SET TRANSACTION ISOLATION LEVEL ${this.level}`);
    } else {
      // MySQL transaction
      await this.execute(`SET TRANSACTION ISOLATION LEVEL ${this.level}`);
      await this.conn.beginTransaction();
    }
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
    if (this.driver === 'postgre') {
      await this.conn.query('COMMIT');
    } else {
      await this.conn.commit();
    }
  }

  async rollback() {
    if (!this.isbegin) {
      throw new Error('Transaction is not begin');
    }
    if (this.driver === 'postgre') {
      await this.conn.query('ROLLBACK');
    } else {
      await this.conn.rollback();
    }
  }
}

module.exports = {
  TransactionOperator,
  TransactionHandler
};
