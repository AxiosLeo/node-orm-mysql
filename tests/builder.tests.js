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
  });
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
    options.tables.push({ table: 'table1', alias: 't1' });
    options.operator = 'select';
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` AS `t1`');
  });

  it('where should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
      operator: 'update',
      data: null,
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('Data is required for update operation');
  });

  it('update operation without condition will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'table1', alias: 't1' }],
      operator: 'update',
      data: { test: 123 },
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('At least one condition is required for update operation');
  });

  it('delete operation without condition will throw error', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
      operator: 'invalid',
      data: null,
      groupField: [],
      having: []
    };
    expect(() => {
      (new Builder(options)).sql;
    }).to.throw('Unsupported \'invalid\' operation.');
  });

  it('build manage sql', () => {
    let options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'table1', alias: 't1' }],
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
      tables: [{ table: 'table1', alias: 't1' }],
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

  it('build with join using subquery', () => {
    const subQuery = new Query('select');
    subQuery.table('table3', 't3').where('t3.status', 1);

    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'table1', alias: 't1' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: [],
      joins: [
        {
          table: subQuery,
          alias: 't2',
          self_column: 't1.id',
          foreign_column: 't2.t1_id',
          join_type: 'left'
        }
      ]
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT * FROM `table1` AS `t1` LEFT JOIN (SELECT * FROM `table3` AS `t3` WHERE `t3`.`status` = ?) AS `t2` ON `t1`.`id` = `t2`.`t1_id`'
    );
  });

  it('test insert operation', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      tables: [{ table: 'table1' }],
      operator: 'insert',
      data: { name: 'test', age: 18 }
    };
    expect((new Builder(options)).sql).to.be.equal(
      'INSERT INTO `table1`(`name`,`age`) VALUES (?,?)'
    );
  });

  it('test batch insert operation', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      tables: [{ table: 'table1' }],
      operator: 'insert',
      data: [
        { name: 'test1', age: 18 },
        { name: 'test2', age: 20 }
      ]
    };
    expect((new Builder(options)).sql).to.be.equal(
      'INSERT INTO `table1`(`name`,`age`) VALUES (?,?),(?,?)'
    );
  });

  it('test insert with on duplicate key update', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      tables: [{ table: 'table1' }],
      operator: 'insert',
      data: { id: 1, name: 'test', age: 18 },
      keys: ['id']
    };
    expect((new Builder(options)).sql).to.be.equal(
      'INSERT INTO `table1`(`id`,`name`,`age`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`),`age` = VALUES(`age`)'
    );
  });

  it('test incrBy operation', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{ key: 'id', opt: '=', value: 1 }],
      tables: [{ table: 'table1' }],
      operator: 'incrBy',
      attrs: ['count'],
      increment: 1
    };
    expect((new Builder(options)).sql).to.be.equal(
      'UPDATE `table1` SET `count` = `count` + ? WHERE `id` = ?'
    );
  });

  it('test condition with JSON field', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'data->$.name',
        opt: '=',
        value: 'test'
      }],
      tables: [{ table: 'table1' }],
      operator: 'select'
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT * FROM `table1` WHERE JSON_EXTRACT(`data`, \'$.name\') = ?'
    );
  });

  it('test condition with IN operator', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'id',
        opt: 'in',
        value: [1, 2, 3]
      }],
      tables: [{ table: 'table1' }],
      operator: 'select'
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT * FROM `table1` WHERE `id` IN (?)'
    );
  });

  it('test condition with BETWEEN operator', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'age',
        opt: 'between',
        value: [18, 30]
      }],
      tables: [{ table: 'table1' }],
      operator: 'select'
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT * FROM `table1` WHERE `age` BETWEEN ? AND ?'
    );
  });

  it('test condition with CONTAIN operator', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'name',
        opt: 'contain',
        value: 'test'
      }],
      tables: [{ table: 'table1' }],
      operator: 'select'
    };
    expect((new Builder(options)).sql).to.be.equal(
      'SELECT * FROM `table1` WHERE `name` LIKE CONCAT(\'%\', ?, \'%\')'
    );
  });

  it('test ManageSQLBuilder create table', () => {
    const options = {
      operator: 'create',
      target: 'table',
      name: 'test_table',
      columns: {
        id: {
          type: 'int',
          primaryKey: true,
          autoIncrement: true,
          comment: 'Primary Key'
        },
        name: {
          type: 'varchar',
          length: 255,
          allowNull: false,
          comment: 'User Name'
        },
        status: {
          type: 'tinyint',
          default: 1,
          comment: 'Status'
        }
      }
    };

    const sql = (new ManageSQLBuilder(options)).sql;
    expect(sql).to.include('CREATE TABLE `test_table`');
    expect(sql).to.include('`id` INT(11) NOT NULL AUTO_INCREMENT COMMENT \'Primary Key\'');
    expect(sql).to.include('`name` VARCHAR(255) NOT NULL COMMENT \'User Name\'');
    expect(sql).to.include('`status` TINYINT(4) DEFAULT 1 COMMENT \'Status\'');
    expect(sql).to.include('PRIMARY KEY (`id`)');
  });

  it('test ManageSQLBuilder create table with DECIMAL type - with length and precision', () => {
    const options = {
      operator: 'create',
      target: 'table',
      name: 'test_table',
      columns: {
        price: {
          type: 'decimal',
          length: 10,
          precision: 2,
          allowNull: false,
          comment: 'Price'
        }
      }
    };

    const sql = (new ManageSQLBuilder(options)).sql;
    expect(sql).to.include('CREATE TABLE `test_table`');
    expect(sql).to.include('`price` DECIMAL(10, 2) NOT NULL COMMENT \'Price\'');
  });

  it('test ManageSQLBuilder create table with DECIMAL type - with length only (default precision)', () => {
    const options = {
      operator: 'create',
      target: 'table',
      name: 'test_table',
      columns: {
        amount: {
          type: 'decimal',
          length: 15,
          comment: 'Amount'
        }
      }
    };

    const sql = (new ManageSQLBuilder(options)).sql;
    expect(sql).to.include('CREATE TABLE `test_table`');
    expect(sql).to.include('`amount` DECIMAL(15, 6) COMMENT \'Amount\'');
  });

  it('test ManageSQLBuilder create table with DECIMAL type - without length (default 10,6)', () => {
    const options = {
      operator: 'create',
      target: 'table',
      name: 'test_table',
      columns: {
        total: {
          type: 'decimal',
          comment: 'Total'
        }
      }
    };

    const sql = (new ManageSQLBuilder(options)).sql;
    expect(sql).to.include('CREATE TABLE `test_table`');
    expect(sql).to.include('`total` DECIMAL(10, 6) COMMENT \'Total\'');
  });

  it('test force index', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      tables: [{ table: 'table1' }],
      operator: 'select',
      forceIndex: 'idx_table1_id'
    };
    expect((new Builder(options)).sql).to.be.equal('SELECT * FROM `table1` FORCE INDEX(idx_table1_id)');

    options.operator = 'update';
    options.data = { name: 'test' };
    options.conditions = [{ key: 'id', opt: '=', value: 1 }];
    expect((new Builder(options)).sql).to.be.equal('UPDATE `table1` FORCE INDEX(idx_table1_id) SET `name` = ? WHERE `id` = ?');
  });
});
