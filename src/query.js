'use strict';

const { buildSql } = require('./builder');

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

class QueryOperator {
  /**
   * 
   * @param {*} conn 
   * @param {TableOption} table 
   */
  constructor(conn, table) {
    this.conn = conn;
    this.options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [],
      operator: null,
      data: null,
      groupField: [],
    };
    this.options.tables.push(table);
  }

  table(tableName, alias) {
    this.options.tables.push({ tableName, alias });
    return this;
  }

  limit(limit) {
    this.options.pageLimit = limit;
    return this;
  }

  offset(offset) {
    this.options.pageOffset = offset;
    return this;
  }

  where(key, value, opt = '=') {
    if (this.options.conditions.length) {
      this.options.conditions.push({ key: null, opt: 'AND', value: null });
    }
    this.options.conditions.push({
      key, opt, value,
    });
    return this;
  }

  whereObject(object = {}) {
    Object.keys(object).forEach((key) => this.where(key, object[key]));
    return this;
  }

  whereConditions(...condition) {
    if (this.options.conditions.length) {
      this.options.conditions.push({ key: null, opt: 'AND', value: null });
    }
    condition.forEach((c) => {
      this.options.conditions.push(c);
    });
    return this;
  }

  orWhere(key, opt, value) {
    if (!this.options.conditions.length) {
      throw new Error('At least one where condition is required');
    }
    this.options.conditions.push({
      key: null,
      opt: 'OR',
      value: null
    }, { key, opt, value });
    return this;
  }

  andWhere(key, opt, value) {
    if (!this.options.conditions.length) {
      throw new Error('At least one where condition is required');
    }
    this.options.conditions.push({
      key: null,
      opt: 'AND',
      value: null
    }, { key, opt, value });
    return this;
  }

  attr(...attr) {
    if (!this.options.attrs) {
      this.options.attrs = [];
    }
    this.options.attrs.push(...attr);
    return this;
  }

  orderBy(sortField, sortOrder = 'asc') {
    this.options.orders.push({ sortField, sortOrder });
    return this;
  }

  groupBy(...groupField) {
    this.options.groupField.push(...groupField);
    return this;
  }

  page(limit, offset = 0) {
    this.options.pageLimit = limit;
    this.options.pageOffset = offset;
    return this;
  }

  set(data) {
    if (!this.options.data) {
      this.options.data = {};
    }
    Object.assign(this.options.data, data);
    return this;
  }

  join(table, alias, on, type) {
    this.options.joins.push({ table, alias, on, type });
    return this;
  }

  buildSql(operator) {
    this.options.operator = operator;
    return buildSql(this.options);
  }

  async exec() {
    if (!this.options.operator) {
      throw new Error('Invalid operator: ' + this.options.operator);
    }
    const { sql, values } = this.buildSql(this.options.operator);
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
    return new QueryOperator(this.conn, {
      tableName: table,
      alias
    });
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
  QueryHandler
};
