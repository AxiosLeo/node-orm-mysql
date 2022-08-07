'use strict';

const expect = require('chai').expect;
const { Builder } = require('../src/builder');

describe('builder test case', () => {
  it('select table should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [],
      operator: null,
      data: null,
      groupField: [],
    };
    options.tables.push({ tableName: 'table1', alias: 't1' });
    options.operator = 'select';
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1`');
  });

  it('where should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
    };
    options.conditions.push({
      key: 't1.id',
      opt: '=',
      value: 1,
    }, {
      key: null,
      opt: 'AND',
      value: 1,
    }, {
      key: null,
      opt: 'OR',
      value: null
    }, {
      key: 'id',
      opt: '>',
      value: 1,
    });
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1` WHERE `t1`.`id` = ? AND ? OR `id` > ?');
  });
});
