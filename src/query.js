'use strict';

class Query {
  constructor(operator = 'select') {
    this.options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [],
      operator,
      data: null,
      groupField: [],
      having: []
    };
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

  join(table, alias, on, type) {
    this.options.joins.push({ table, alias, on, type });
    return this;
  }
}

module.exports = Query;
