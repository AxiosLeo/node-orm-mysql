'use strict';

const { Builder } = require('./builder');
const Query = require('./query');
const Hook = require('./hook');
const { _query } = require('./core');

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
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, res);
    } catch (err) {
      Hook.listen({ label: 'post', table: from, opt: this.options.operator }, this.options, err);
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

  async insert(data) {
    this.options.operator = 'insert';
    if (typeof data !== 'undefined') {
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

  async upsertRow(data, ...conditions) {
    if (conditions.length === 0) {
      throw new Error('conditions is required');
    }
    const query = new QueryOperator(this.conn, this.options);
    const count = await query.whereConditions(...conditions).count();
    if (count) {
      return await query.whereConditions(...conditions).update(data);
    }
    return await query.insert(data);
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

  async upsert(tableName, data, condition = {}) {
    const count = await this.table(tableName).whereObject(condition).count();
    if (count) {
      return await this.table(tableName).whereObject(condition).update(data);
    }
    return await this.table(tableName).insert(data);
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
}

module.exports = {
  QueryOperator,
  QueryHandler,
  Query
};
