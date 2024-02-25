'use strict';

/**
 * @type {Chai.ExpectStatic}
 */
let expect = null;
const { Builder, ManageSQLBuilder } = require('../src/builder');
const { Query } = require('../src/operator');

describe('builder test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  })
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
      having: []
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
      having: []
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
  it('find should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'find',
      data: null,
      groupField: [],
      having: []
    };
    options.conditions.push({
      key: 't1.id',
      opt: '=',
      value: 1,
    });
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1` WHERE `t1`.`id` = ?  LIMIT 1');
  });
  it('sub query should be ok', () => {
    let query = new Query('count', '> 0 AS has_children');
    query.table('table2', 't2').where('t2.parent_id', '`t1`.`id`');
    let options = {
      sql: '',
      attrs: ['t1.id', 't1.name', 't1.parent_id', query],
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT `t1`.`id`,`t1`.`name`,`t1`.`parent_id`,' +
      // Sub query
      '(SELECT COUNT(*) AS count FROM `table2` AS `t2` WHERE `t2`.`parent_id` = `t1`.`id`) > 0 AS `has_children` ' +
      'FROM `table1` AS `t1`'
    );

    // without alias
    query = new Query('count');
    query.table('table2', 't2').where('t2.parent_id', '`t1`.`id`');
    options = {
      sql: '',
      attrs: ['t1.id', 't1.name', 't1.parent_id', query],
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT `t1`.`id`,`t1`.`name`,`t1`.`parent_id`,' +
      // Sub query
      '(SELECT COUNT(*) AS count FROM `table2` AS `t2` WHERE `t2`.`parent_id` = `t1`.`id`) ' +
      'FROM `table1` AS `t1`'
    );
  });

  it('Build sql with suffix', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: [],
      suffix: 'FOR UPDATE'
    };
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1` FOR UPDATE');
  });

  it('update operation without data will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'update',
      data: null,
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('Data is required for update operation');
  })

  it('update operation without condition will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'update',
      data: { test: 123 },
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('At least one condition is required for update operation');
  })

  it('delete operation without condition will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'delete',
      data: null,
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('At least one where condition is required for delete operation');
  });

  it('delete operation success', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'delete',
      data: null,
      groupField: [],
      having: []
    };
    options.conditions.push({
      key: 't1.id',
      opt: '=',
      value: 1,
    });
    expect((new Builder(options)).sql).to.be.equal('DELETE FROM `table1` AS `t1` WHERE `t1`.`id` = ?');
  });

  it('count operation with throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'count',
      data: null,
      groupField: [],
      having: [{ key: 't1.id', opt: '>', value: 1 }]
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('"HAVING" is not allowed without "GROUP BY"');
  });

  it('count operation success', () => {
    const options = {
      sql: '',
      values: [],
      attrs: ['count'],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'count',
      data: null,
      groupField: ['t1.id'],
      having: [{ key: 't1.id', opt: '>', value: 1 }]
    };
    expect((new Builder(options)).sql).to.be.equal('SELECT COUNT(*) AS count FROM `table1` AS `t1` GROUP BY `t1`.`id` HAVING `t1`.`id` > ?');
  });

  it('build sql with invalid operator will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'invalid',
      data: null,
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('Invalid operator: invalid');
  });

  it('build manage sql', () => {
    let options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    expect((new ManageSQLBuilder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1`');

    // create index
    options = {
      operator: 'create',
      target: 'index',
      table: 'table1',
      name: 'idx_table1_id',
      columns: ['id'],
    };
    expect((new ManageSQLBuilder(options)).sql).to.be.equal('CREATE INDEX `idx_table1_id` ON `table1` (`id`) VISIBLE');
  });

  it('build with join', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ tableName: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: [],
      joins: [
        {
          table: 'table2',
          alias: 't2',
          self_column: 't1.id',
          foreign_column: 't2.t1_id',
          join_type: 'left'
        }
      ]
    };
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1` LEFT JOIN `table2` AS `t2` ON `t1`.`id` = `t2`.`t1_id`');
  });
});
