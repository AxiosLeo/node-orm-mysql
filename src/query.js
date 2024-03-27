'use strict';

const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const { _validate } = require('./utils');
const is = require('@axiosleo/cli-tool/src/helper/is');

const optType = [
  '=', '!=', '>', '<', '>=', '<=',
  'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN', 'IS', 'IS NOT', 'REGEXP', 'NOT REGEXP', 'AND', 'OR', 'GROUP', 'CONTAIN', 'NOT CONTAIN', 'OVERLAPS', 'NOT OVERLAPS'
];

function joinOn(table, on, options = {}) {
  let o = _assign({ alias: null, join_type: 'INNER', table, on }, options);
  if (!table) {
    throw new Error('table is required');
  }
  if (!on) {
    throw new Error('on is required');
  }
  this.options.joins.push(o);
  return this;
}

class QueryCondition {
  constructor() {
    this.options = {
      conditions: []
    };
  }

  where(...args) {
    if (this.options.conditions.length !== 0 && args.length > 1) {
      const last = this.options.conditions[this.options.conditions.length - 1];
      if (last.opt) {
        const opt = last.opt.toUpperCase();
        if (opt !== 'AND' && opt !== 'OR') {
          this.options.conditions.push({ key: null, opt: args[3] === true ? 'OR' : 'AND', value: null });
        }
      }
    }
    switch (args.length) {
      case 4:
      case 3: {
        const [key, opt, value] = args;
        if (is.string(value) && optType.includes(value.toUpperCase())) {
          this.options.conditions.push({ key, opt: value.toUpperCase(), value: opt });
          break;
        }
        this.options.conditions.push({ key, opt: opt.toUpperCase(), value });
        break;
      }
      case 2: {
        const [key, value] = args;
        this.options.conditions.push({ key, opt: '=', value });
        break;
      }
      case 1: {
        const [opt] = args;
        this.options.conditions.push({ key: null, opt, value: null });
        break;
      }
      default: {
        throw new Error('Invalid arguments');
      }
    }
    return this;
  }

  whereAnd() {
    this.options.conditions.push({ key: null, opt: 'AND', value: null });
    return this;
  }

  whereOr() {
    this.options.conditions.push({ key: null, opt: 'OR', value: null });
    return this;
  }

  whereIn(key, value) {
    this.where(key, 'IN', value);
    return this;
  }

  whereNotIn(key, value) {
    this.where(key, 'NOT IN', value);
    return this;
  }

  whereContain(key, value) {
    this.where(key, 'CONTAIN', value);
    return this;
  }

  whereNotContain(key, value) {
    this.where(key, 'NOT CONTAIN', value);
    return this;
  }

  whereBetween(key, value) {
    this.where(key, 'BETWEEN', value);
    return this;
  }

  whereNotBetween(key, value) {
    this.where(key, 'NOT BETWEEN', value);
    return this;
  }

  whereOverlaps(key, value) {
    this.where(key, 'OVERLAPS', value);
    return this;
  }

  whereNotOverlaps(key, value) {
    this.where(key, 'NOT OVERLAPS', value);
    return this;
  }

  whereLike(key, value) {
    if (is.array(value)) {
      value = value.join('');
    }
    this.where(key, 'LIKE', value);
    return this;
  }

  whereNotLike(key, value) {
    if (is.array(value)) {
      value = value.join('');
    }
    this.where(key, 'NOT LIKE', value);
    return this;
  }

  /**
   * @param {QueryCondition} condition 
   * @returns 
   */
  whereCondition(condition) {
    this.options.conditions.push({ key: null, opt: 'GROUP', value: condition.options.conditions });
    return this;
  }

  whereObject(object = {}) {
    Object.keys(object).forEach((key) => this.where(key, object[key]));
    return this;
  }
}

class Query extends QueryCondition {
  constructor(operator = 'select', alias = null) {
    super();
    this.options = {
      driver: 'mysql',
      queryHandler: null,
      conditions: [],
      orders: [],
      tables: [],
      attrs: [],
      operator,
      data: null,
      groupField: [],
      having: [],
      joins: [],
      suffix: null,
      transaction: false,
      keys: null,
      explain: false,
    };
    this.alias = alias || null;
  }

  table(table, alias) {
    this.options.tables.push({ table, alias });
    return this;
  }

  tables(...tables) {
    this.options.tables = tables;
    return this;
  }

  keys(...keys) {
    this.options.keys = keys;
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

  attr(...attrs) {
    if (!attrs.length) {
      this.options.attrs = [];
      return this;
    }
    this.options.attrs = attrs;
    return this;
  }

  orderBy(sortField, sortOrder = 'asc') {
    this.options.orders.push({ sortField, sortOrder });
    return this;
  }

  groupBy(...groupField) {
    this.options.groupField = groupField;
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
    if (is.invalid(data)) {
      throw new Error('data is required');
    }
    this.options.data = data;
    return this;
  }

  /**
   * @param {{table:string,table_alias?:string,self_column: string,foreign_column: string,join_type?: 'left' | 'right' | 'inner'}} opt 
   * @returns 
   */
  join(opt = {}) {
    let types = ['left', 'right', 'inner'];
    opt.join_type = opt.join_type ? opt.join_type.toLowerCase() : 'inner';
    if (types.indexOf(opt.join_type) === -1) {
      throw new Error('Invalid join type : ' + opt.join_type + '; only supported ' + types.join(', '));
    }
    _validate(opt, {
      table: 'required',
      self_column: 'required',
      foreign_column: 'required_if:on',
      join_type: [{ in: types }]
    });
    let { table, table_alias, self_column, foreign_column, join_type } = opt;
    this.options.joins.push({ table, alias: table_alias, self_column, foreign_column, join_type });
    return this;
  }

  leftJoin(table, on, options = {}) {
    return joinOn.call(this, table, on, { ...options, join_type: 'LEFT' });
  }

  rightJoin(table, on, options = {}) {
    return joinOn.call(this, table, on, { ...options, join_type: 'RIGHT' });
  }

  innerJoin(table, on, options = {}) {
    return joinOn.call(this, table, on, { ...options, join_type: 'INNER' });
  }

  /**
   * @deprecated
   * @param  {...any} conditions 
   * @returns 
   */
  whereConditions(...conditions) {
    if (!conditions.length) {
      return this;
    }
    if (this.options.conditions.length && !is.string(conditions[0])) {
      this.options.conditions.push({ key: null, opt: 'AND', value: null });
    }
    conditions.forEach((c) => {
      if (is.string(c)) {
        this.options.conditions.push({ key: null, opt: c, value: null });
      } else if (is.object(c)) {
        this.options.conditions.push({
          key: null,
          opt: '=',
          value: null,
          ...c
        });
      } else if (is.array(c)) {
        const [k, o, v] = c;
        if (c.length === 2) {
          this.options.conditions.push({ key: k, opt: '=', value: o });
        } else if (c.length === 3) {
          this.options.conditions.push({ key: k, opt: o, value: v });
        } else {
          throw new Error('Invalid condition: ' + c);
        }
      } else {
        this.options.conditions.push(c);
      }
    });
    return this;
  }

  /**
   * @deprecated
   * @param  {...any} conditions 
   * @returns 
   */
  groupWhere(...conditions) {
    if (!conditions.length) {
      return this;
    }
    const condition = { key: null, opt: 'group', value: [] };
    conditions.forEach((c) => {
      if (is.string(c)) {
        condition.value.push({ key: null, opt: c, value: null });
      } else if (is.object(c)) {
        condition.value.push({
          key: null,
          opt: '=',
          value: null,
          ...c
        });
      } else if (is.array(c)) {
        const [k, o, v] = c;
        if (c.length === 2) {
          condition.value.push({ key: k, opt: '=', value: o });
        } else if (c.length === 3) {
          condition.value.push({ key: k, opt: o, value: v });
        } else {
          throw new Error('Invalid condition: ' + c);
        }
      } else {
        condition.value.push(c);
      }
    });
    this.options.conditions.push(condition);
    return this;
  }

  /**
   * @deprecated
   * @param {*} key 
   * @param {*} opt 
   * @param {*} value 
   * @returns 
   */
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

  /**
   * @deprecated
   * @param {*} key 
   * @param {*} opt 
   * @param {*} value 
   * @returns 
   */
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
}

module.exports = { Query, QueryCondition };
