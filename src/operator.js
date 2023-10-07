'use strict';

const { Builder } = require('./builder');
const Query = require('./query');
const Hook = require('./hook');

const query = async (conn, options, opt = null) => {
  switch (options.driver) {
    case 'mysql': {
      if (opt === null) {
        const builder = new Builder(options);
        opt = {
          sql: builder.sql,
          values: builder.values || [],
        };
      }
      return new Promise((resolve, reject) => {
        if (options.transaction) {
          conn.execute(opt)
            .then((res) => resolve(res))
            .catch((err) => reject(err));
        } else {
          conn.query(opt, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        }
      });
    }
    default: {
      const promise = options.query_handler(conn, options, opt);
      if (!(promise instanceof Promise)) {
        throw new Error('query_handler must return a promise');
      }
      return promise;
    }
  }
};

class QueryOperator extends Query {
  /**
   * @param {*} conn 
   */
  constructor(conn = null, options = {}) {
    super(null);
    this.conn = conn;
    this.options.driver = options.driver || 'mysql';
    this.options.query_handler = options.query_handler || null;
    if (this.options.driver !== 'mysql') {
      if (!this.options.query_handler) {
        throw new Error('query_handler is required');
      }
      if (!(this.options.query_handler instanceof Function)) {
        throw new Error('query_handler must be a function');
      }
    }
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
    const from = this.options.tables.map(t => t.tableName).join(',');
    Hook.listen({ label: 'pre', table: from, opt: this.options.operator }, this.options);
    let res;
    try {
      switch (this.options.operator) {
        case 'find': {
          const tmp = await query(this.conn, this.options);
          res = tmp[0];
          break;
        }
        case 'count': {
          const [tmp] = await query(this.conn, this.options);
          res = tmp.count;
          break;
        }
        default:
          res = await query(this.conn, this.options);
      }
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, res);
    } catch (err) {
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, err);
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
  constructor(conn, options = {}) {
    this.conn = conn;
    this.optinos = options;
  }

  async query(opt) {
    if (!opt) {
      throw new Error('opt is required');
    }
    return await query(this.conn, this.options, opt);
  }

  table(table, alias = null) {
    return (new QueryOperator(this.conn, this.optinos)).table(table, alias);
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
