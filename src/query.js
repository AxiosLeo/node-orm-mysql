'use strict';

class Query {
  constructor(operator = 'select', alias = null) {
    this.options = {
      driver: 'mysql',
      queryHandler: null,
      conditions: [],
      orders: [],
      tables: [],
      operator,
      data: null,
      groupField: [],
      having: [],
      joins: [],
      suffix: null,
      transaction: false
    };
    this.alias = alias || null;
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

  /**
   * 
   * @param {string} key 
   * @param {any} value 
   * @param {*} opt 
   * @returns 
   */
  where(key, value, opt = '=') {
    if (!key) {
      throw new Error('key is required');
    }
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
    if (!condition.length) {
      return this;
    }
    if (this.options.conditions.length) {
      this.options.conditions.push({ key: null, opt: 'AND', value: null });
    }
    condition.forEach((c) => {
      this.options.conditions.push(c);
    });
    return this;
  }

  groupWhere(...conditions) {
    if (!conditions.length) {
      return this;
    }
    const condition = { key: null, opt: 'group', value: [] };
    conditions.forEach((c) => {
      condition.value.push(c);
    });
    this.options.conditions.push(condition);
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
    if (!attr.length) {
      return this;
    }
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

  having(key, opt = '=', value = null) {
    let optUpper = opt.toUpperCase();
    if (optUpper === 'AND' || optUpper === 'OR') {
      this.options.having.push({ key: null, opt: optUpper, value: null });
      return this;
    }
    if (this.options.having.length) {
      let lastOpt = this.options.having[this.options.having.length - 1].opt.toUpperCase();
      if (lastOpt !== 'AND' && lastOpt !== 'OR') {
        this.options.having.push({ key: null, opt: 'AND', value: null });
      }
    }
    this.options.having.push({ key, opt, value });
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

  /**
   * @param {{table:string,table_alias?:string,self_column: string,foreign_column: string,join_type?: 'left' | 'right' | 'inner'}} opt 
   * @returns 
   */
  join(opt = {}) {
    let { table, table_alias, self_column, foreign_column, join_type } = opt;
    if (!table) {
      throw new Error('table is required');
    }
    if (!self_column) {
      throw new Error('self_column is required');
    }
    if (!foreign_column) {
      throw new Error('foreign_column is required');
    }
    if (join_type && ['left', 'right', 'inner'].indexOf(join_type) === -1) {
      throw new Error('Invalid join type : ' + join_type + '; only supported left, right, inner');
    }
    this.options.joins.push({ table, alias: table_alias, self_column, foreign_column, join_type });
    return this;
  }
}

module.exports = Query;
