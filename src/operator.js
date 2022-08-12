'use strict';

const { Builder } = require('./builder');
const Query = require('./query');

const query = async (conn, options) => {
  return new Promise((resolve, reject) => {
    conn.query(options, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

class QueryOperator extends Query {
  /**
   * @param {*} conn 
   */
  constructor(conn) {
    super(null);
    this.conn = conn;
  }

  buildSql(operator) {
    this.options.operator = operator;
    return new Builder(this.options);
  }

  async exec() {
    if (!this.options.operator) {
      throw new Error('Invalid operator: ' + this.options.operator);
    }
    const builder = this.buildSql(this.options.operator);
    const { sql, values } = builder;
    const options = {
      sql, values
    };
    switch (this.options.operator) {
      case 'find': {
        const res = await query(this.conn, options);
        return res[0];
      }
      case 'count': {
        const [res] = await query(this.conn, options);
        return res.count;
      }
      default:
        return query(this.conn, options);
    }
  }

  async select() {
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

  async insert(data) {
    this.options.operator = 'insert';
    if (data) {
      this.set(data);
    }
    return await this.exec();
  }

  async count() {
    this.options.operator = 'count';
    return await this.exec();
  }

  async delete(id) {
    if (id) {
      this.where('id', id);
    }
    this.options.operator = 'delete';
    return await this.exec();
  }
}

class QueryHandler {
  constructor(conn) {
    this.conn = conn;
  }

  async query(options) {
    return new Promise((resolve, reject) => {
      this.conn.query(options, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  table(table, alias = null) {
    return (new QueryOperator(this.conn)).table(table, alias);
  }

  async upsert(tableName, data, condition = {}) {
    const count = await this.table(tableName).whereObject(condition).count();
    if (count) {
      return await this.table(tableName).whereObject(condition).update(data);
    }
    return await this.table(tableName).insert(data);
  }
}

module.exports = {
  QueryOperator,
  QueryHandler,
  Query
};
