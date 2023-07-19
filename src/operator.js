'use strict';

const { Builder } = require('./builder');
const Query = require('./query');
const { handleEvent } = require('./hook');

const query = async (conn, options, transaction) => {
  return new Promise((resolve, reject) => {
    if (transaction) {
      conn.execute(options)
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    } else {
      conn.query(options, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    }
  });
};

class QueryOperator extends Query {
  /**
   * @param {*} conn 
   */
  constructor(conn = null) {
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
    if (this.conn === null) {
      throw new Error('Connection is null');
    }
    const builder = this.buildSql(this.options.operator);
    const { sql, values } = builder;
    const options = {
      sql, values
    };
    const from = this.options.tables.map(t => t.tableName).join(',');
    handleEvent('pre', from, this.options.operator, this.options);
    let res;
    try {
      switch (this.options.operator) {
        case 'find': {
          const tmp = await query(this.conn, options, this.options.transaction);
          res = tmp[0];
          break;
        }
        case 'count': {
          const [tmp] = await query(this.conn, options, this.options.transaction);
          res = tmp.count;
          break;
        }
        default:
          res = await query(this.conn, options, this.options.transaction);
      }
      handleEvent('post', from, this.options.operator, this.options, res);
    } catch (err) {
      handleEvent('post', from, this.options.operator, this.options, err);
      throw err;
    }
    return res;
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

  async delete(id, index_field_name = 'id') {
    if (id) {
      this.where(index_field_name, id);
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
