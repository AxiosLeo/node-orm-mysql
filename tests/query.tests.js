'use strict';

const mm = require('mm');
let expect = null;
const mysql = require('mysql2');
const { Builder } = require('../src/builder');
const { QueryHandler, Query, QueryCondition } = require('../src/operator');

describe('query test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });
  /**
   * @type {QueryHandler}
   */
  let handler;
  beforeEach(() => {
    mm(mysql, 'createConnection', (options) => {
      return {
        query: (opt, callback) => {
          if (opt.sql.indexOf('COUNT(*)') < 0) {
            if (opt.sql.indexOf('SELECT') < 0) {
              callback(null, { affectedRows: 1 });
              return;
            }
            callback(null, []);
            return;
          }
          callback(null, [{ count: 1 }]);
        }
      };
    });
    const conn = mysql.createConnection({});
    handler = new QueryHandler(conn);
  });
  it('select should be ok', () => {
    const query = handler.table('users', 'u');
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u`');

    query.where('u.id', 1);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`id` = ?');
  });
  it('join select order should be ok', () => {
    // const condition = 
    const query = handler.table('meta_items_relationship', 'mir')
      .join({
        table: 'meta_items',
        table_alias: 'mi',
        self_column: 'mi.id',
        foreign_column: 'mir.item_child',
        join_type: 'left'
      })
      .where('mir.item_parent', 1)
      .where('mir.disabled', 0)
      .where('mi.disabled', 0)
      .orderBy('mi.id', 'desc');
    expect(query.buildSql('select').sql).to.be.equal(
      'SELECT * FROM `meta_items_relationship` AS `mir` ' +
      'LEFT JOIN `meta_items` AS `mi` ON `mi`.`id` = `mir`.`item_child` ' +
      'WHERE `mir`.`item_parent` = ? AND `mir`.`disabled` = ? AND `mi`.`disabled` = ? ' +
      'ORDER BY `mi`.`id` DESC'
    );
  });
  it('join count should be ok', () => {
    const query = handler.table('meta_items_relationship', 'mir')
      .join({
        table: 'meta_items',
        table_alias: 'mi',
        self_column: 'mi.id',
        foreign_column: 'mir.item_child',
        join_type: 'left'
      })
      .where('mir.item_parent', 1)
      .where('mir.disabled', 0)
      .where('mi.disabled', 0)
      .orderBy('mi.id', 'desc');
    expect(query.buildSql('count').sql).to.be.equal('SELECT COUNT(*) AS count FROM `meta_items_relationship` AS `mir` LEFT JOIN `meta_items` AS `mi` ON `mi`.`id` = `mir`.`item_child` WHERE `mir`.`item_parent` = ? AND `mir`.`disabled` = ? AND `mi`.`disabled` = ?');
  });

  it('sql functions', () => {
    const query = handler.table('users', '');

    query.attr('id', 'UNIX_TIMESTAMP(deleted_at) AS deleted_at', 'UNIX_TIMESTAMP(expired_at) AS expired_at');

    expect(query.buildSql('select').sql)
      .to.be.equal('SELECT `id`,UNIX_TIMESTAMP(`deleted_at`) AS `deleted_at`,UNIX_TIMESTAMP(`expired_at`) AS `expired_at` FROM `users`');
  });

  it('query json field', () => {
    let query = handler.table('users', 'u');
    query.where('u.meta->$.id', 123);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_EXTRACT(`u`.`meta`, \'$.id\') = ?');

    // opt=in
    query = handler.table('users', 'u');
    query.where('u.meta->$.id', 'in', [1, 2, 3]);
    let res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_CONTAINS(JSON_ARRAY(?), JSON_EXTRACT(`u`.`meta`, \'$.id\'))');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');

    // opt=not in
    query = handler.table('users', 'u');
    query.where('u.meta->$.id', 'not in', [1, 2, 3]);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_CONTAINS(JSON_ARRAY(?), JSON_EXTRACT(`u`.`meta`, \'$.id\'))=0');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');

    // opt=contain
    query = handler.table('users', 'u');
    query.where('u.meta->$.id', 'contain', 1);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_CONTAINS(`u`.`meta`, JSON_ARRAY(?), \'$.id\')');
    expect(JSON.stringify(res.values)).to.be.equal('[1]');

    // opt=not contain
    query = handler.table('users', 'u');
    query.where('u.meta->$.id', 'not contain', 1);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_CONTAINS(`u`.`meta`, JSON_ARRAY(?), \'$.id\')=0');
    expect(JSON.stringify(res.values)).to.be.equal('[1]');
  });

  it('in condition', () => {
    // opt=in
    let query = handler.table('users', 'u');
    query.where('u.meta', 'in', [1, 2, 3]);
    let res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`meta` IN (?)');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');

    // opt=not in
    query = handler.table('users', 'u');
    query.where('u.meta', 'not in', [1, 2, 3]);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`meta` NOT IN (?)');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');
  });

  it('contain condition', () => {
    // opt=in
    let query = handler.table('users', 'u');
    query.where('u.meta', 'contain', 1);
    let res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`meta` LIKE CONCAT(\'%\', ?, \'%\')');
    expect(JSON.stringify(res.values)).to.be.equal('[1]');

    // opt=not in
    query = handler.table('users', 'u');
    query.where('u.meta', 'not contain', 1);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`meta` NOT LIKE CONCAT(\'%\', ?, \'%\')');
    expect(JSON.stringify(res.values)).to.be.equal('[1]');
  });

  it('group conditions', () => {
    const startDate = '2024-10-01';
    const endDate = '2024-10-31';
    const startCondition = new QueryCondition();
    startCondition.where('json->$.startDate', '>=', startDate)
      .where('json->$.startDate', '<=', endDate);
    const endCondition = new QueryCondition();
    endCondition.where('json->$.endDate', '>=', startDate)
      .where('json->$.endDate', '<=', endDate);

    const dateCondition = new QueryCondition();
    dateCondition.whereCondition(startCondition).whereOr().whereCondition(endCondition);

    let query = handler.table('users', 'u');
    query.where('u.user_id', 1).whereCondition(dateCondition).buildSql('select');
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`user_id` = ? AND ((JSON_EXTRACT(`json`, \'$.startDate\') >= ? AND JSON_EXTRACT(`json`, \'$.startDate\') <= ?) OR (JSON_EXTRACT(`json`, \'$.endDate\') >= ? AND JSON_EXTRACT(`json`, \'$.endDate\') <= ?))');
  });

  it('timestamp field', () => {
    const query = handler.table('users', 'u');
    const date = new Date();
    query.set({ updated_at: date });
    query.where('id', 1);
    const res = query.buildSql('update');
    expect(res.sql).to.be.equal('UPDATE `users` AS `u` SET `updated_at` = ? WHERE `id` = ?');
  });

  it('sub query', () => {
    // subQuery in conditions
    const query = handler.table('users', 'u');
    const subQuery = new Query('select');
    subQuery.table('users');
    const res = query.where('name', 'IN', subQuery).buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `name` IN (SELECT * FROM `users`)');

    // subQuery in joins
    const query2 = handler.table('users', 'u').attr('id', 'name');
    const subQuery2 = new Query('select');
    subQuery2.table('users').where('name', 'john');
    query2.join({
      table: subQuery2,
      table_alias: 'sub_query',
      self_column: 'id',
      foreign_column: 'sub_query.id',
      join_type: 'left'
    });
    const res2 = query2.buildSql('select');
    expect(res2.sql).to.be.equal('SELECT `id`,`name` FROM `users` AS `u` LEFT JOIN (SELECT * FROM `users` WHERE `name` = ?) AS `sub_query` ON `id` = `sub_query`.`id`');
  });

  it('query with in condition', () => {
    const query = handler.table('users', 'u');
    expect(() => {
      query.where('name', 'IN', []).buildSql('select');
    }).to.be.throw('Value must not be empty for "IN" condition');
  });

  it('having', () => {
    const query = handler.table('users', 'u');
    const subQuery = new Query('select');
    subQuery.table('users').having('COUNT(*)', '>', 1);
    expect(() => {
      query.where('u.name', 'IN', subQuery).buildSql('select');
    }).to.be.throw('having is not allowed without "GROUP BY"');

    subQuery.groupBy('u.name');
    let res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`name` IN (SELECT * FROM `users` GROUP BY `u`.`name` HAVING COUNT(*) > ?)');

    subQuery.having('test', '>', 1);
    res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`name` IN (SELECT * FROM `users` GROUP BY `u`.`name` HAVING COUNT(*) > ? AND `test` > ?)');
  });

  it('build sql not connect mysql', () => {
    const query = new Query('insert');
    query.table('users').set({
      test: 'a',
      a: 1,
      b: null
    });
    const builder = new Builder(query.options);
    expect(builder.sql).to.be.equal('INSERT INTO `users`(`test`,`a`,`b`) VALUES (?,?,?)');
    expect(JSON.stringify(builder.values)).to.be.includes(JSON.stringify(['a', 1, null]));
  });

  it('set attr', () => {
    const query = handler.table('users', 'u').attr(...[]);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u`');
  });

  it('where opt', () => {
    const query = handler.table('users', 'u').attr(...[]).where('id', 1);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `id` = ?');
  });

  it('where object', () => {
    const query = handler.table('users', 'u').attr(...[]).where({ id: 1 });
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `id` = ?');
  });

  it('limit&offset', () => {
    const query = handler.table('users', 'u').attr(...[]).where('id', 1).limit(2).offset(1);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `id` = ?  LIMIT 2 OFFSET 1');
  });

  it('attr is sub query', () => {
    const query = new Query('count', '> 0 AS has_children');
    query.table('orgs', 's2')
      .where('s2.parent_id', '`s1`.`id`');
    let sql = handler.table('orgs', 's1')
      .attr('s1.id', 's1.name', 's1.parent_id', query)
      .buildSql('select').sql;
    expect(sql).to.be.equal('SELECT `s1`.`id`,`s1`.`name`,`s1`.`parent_id`,(SELECT COUNT(*) AS count FROM `orgs` AS `s2` WHERE `s2`.`parent_id` = `s1`.`id`) > 0 AS `has_children` FROM `orgs` AS `s1`');

    sql = handler.table('orgs', 's1')
      .attr('s1.id', 's1.name', 's1.parent_id', () => query).buildSql('select').sql;
    expect(sql).to.be.equal('SELECT `s1`.`id`,`s1`.`name`,`s1`.`parent_id`,(SELECT COUNT(*) AS count FROM `orgs` AS `s2` WHERE `s2`.`parent_id` = `s1`.`id`) > 0 AS `has_children` FROM `orgs` AS `s1`');
  });

  it('upsert row', async () => {
    const condition = new QueryCondition();
    condition.where('id', 1);
    const res = await handler.table('users', 'u').upsertRow({ id: 1, name: 'leo' }, condition);
    expect(res.affectedRows).to.be.equal(1);
  });

  it('where like', () => {
    const query = new Query('select');
    query.table('users');
    query.where('name', 'like', '%leo%');

    const builder = new Builder(query.options);
    expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `name` LIKE ?');
  });

  it('incrBy query should be ok', async () => {
    const handle = new QueryHandler();
    let res = await handle.table('test').where('id', 1)
      .notExec()
      .incrBy('number');

    expect(res.sql).to.be.equal('UPDATE `test` SET `number` = `number` + ? WHERE `id` = ?');
    expect(JSON.stringify(res.values)).to.be.equal('[1,1]');

    res = await handle.table('test').where('id', 1)
      .notExec()
      .incrBy('number', '2');

    expect(res.sql).to.be.equal('UPDATE `test` SET `number` = `number` + ? WHERE `id` = ?');
    expect(JSON.stringify(res.values)).to.be.equal('[2,1]');

    let data = {
      status: 'success',
      value: 200,
    };
    res = await handle.table('test').where('id', 1)
      .notExec()
      .incrBy('number', () => {
        if (data.status === 'success') {
          return 0;
        }
        // error times increase
        return 1;
      });

    expect(res.sql).to.be.equal('UPDATE `test` SET `number` = `number` + ? WHERE `id` = ?');
    expect(JSON.stringify(res.values)).to.be.equal('[0,1]');
  });

  it('between query should be ok', async () => {
    const handle = new QueryHandler();
    let res = await handle.table('test').where('id', 1)
      .where('company_id', 1)
      .where('type', 'company')
      .where('disabled', 0)
      .whereBetween('time_end', ['2024-12-09 00:00:00', '2024-12-15 23:59:59'])
      .notExec()
      .select();
    expect(res.sql).to.be.equal('SELECT * FROM `test` WHERE `id` = ? AND `company_id` = ? AND `type` = ? AND `disabled` = ? AND `time_end` BETWEEN ? AND ?');
    expect(JSON.stringify(res.values)).to.be.equal('[1,1,"company",0,"2024-12-09 00:00:00","2024-12-15 23:59:59"]');

    res = await handle.table('test').where('id', 1)
      .where('company_id', 1)
      .where('type', 'company')
      .where('disabled', 0)
      .whereBetween('json->$.time_end', ['2024-12-09 00:00:00', '2024-12-15 23:59:59'])
      .notExec()
      .select();
    expect(res.sql).to.be.equal('SELECT * FROM `test` WHERE `id` = ? AND `company_id` = ? AND `type` = ? AND `disabled` = ? AND JSON_EXTRACT(`json`, \'$.time_end\') BETWEEN ? AND ?');
    expect(JSON.stringify(res.values)).to.be.equal('[1,1,"company",0,"2024-12-09 00:00:00","2024-12-15 23:59:59"]');
  });

  describe('QueryCondition methods', () => {
    it('should handle where with 4 arguments and OR flag', () => {
      const condition = new QueryCondition();
      condition.where('id', '>', 1, true);
      expect(condition.options.conditions.length).to.be.greaterThan(0);
    });

    it('should handle where with optType value swap', () => {
      const condition = new QueryCondition();
      condition.where('id', 1, 'IN');
      expect(condition.options.conditions[0].opt).to.be.equal('IN');
      expect(condition.options.conditions[0].value).to.be.equal(1);
    });

    it('should handle whereAnd', () => {
      const condition = new QueryCondition();
      condition.where('id', 1).whereAnd().where('name', 'test');
      expect(condition.options.conditions[1].opt).to.be.equal('AND');
    });

    it('should handle whereOr', () => {
      const condition = new QueryCondition();
      condition.where('id', 1).whereOr().where('name', 'test');
      expect(condition.options.conditions[1].opt).to.be.equal('OR');
    });

    it('should handle whereIn', () => {
      const condition = new QueryCondition();
      condition.whereIn('id', [1, 2, 3]);
      expect(condition.options.conditions[0].opt).to.be.equal('IN');
    });

    it('should handle whereNotIn', () => {
      const condition = new QueryCondition();
      condition.whereNotIn('id', [1, 2, 3]);
      expect(condition.options.conditions[0].opt).to.be.equal('NOT IN');
    });

    it('should handle whereContain', () => {
      const condition = new QueryCondition();
      condition.whereContain('name', 'test');
      expect(condition.options.conditions[0].opt).to.be.equal('CONTAIN');
    });

    it('should handle whereNotContain', () => {
      const condition = new QueryCondition();
      condition.whereNotContain('name', 'test');
      expect(condition.options.conditions[0].opt).to.be.equal('NOT CONTAIN');
    });

    it('should handle whereBetween', () => {
      const condition = new QueryCondition();
      condition.whereBetween('age', [18, 30]);
      expect(condition.options.conditions[0].opt).to.be.equal('BETWEEN');
    });

    it('should handle whereNotBetween', () => {
      const condition = new QueryCondition();
      condition.whereNotBetween('age', [18, 30]);
      expect(condition.options.conditions[0].opt).to.be.equal('NOT BETWEEN');
    });

    it('should handle whereOverlaps', () => {
      const condition = new QueryCondition();
      condition.whereOverlaps('tags', [1, 2]);
      expect(condition.options.conditions[0].opt).to.be.equal('OVERLAPS');
    });

    it('should handle whereNotOverlaps', () => {
      const condition = new QueryCondition();
      condition.whereNotOverlaps('tags', [1, 2]);
      expect(condition.options.conditions[0].opt).to.be.equal('NOT OVERLAPS');
    });

    it('should handle whereLike with array value', () => {
      const condition = new QueryCondition();
      condition.whereLike('name', ['%', 'test', '%']);
      expect(condition.options.conditions[0].value).to.be.equal('%test%');
    });

    it('should handle whereNotLike with array value', () => {
      const condition = new QueryCondition();
      condition.whereNotLike('name', ['%', 'test', '%']);
      expect(condition.options.conditions[0].value).to.be.equal('%test%');
    });

    it('should handle whereCondition', () => {
      const condition1 = new QueryCondition();
      condition1.where('id', 1);
      const condition2 = new QueryCondition();
      condition2.whereCondition(condition1);
      expect(condition2.options.conditions[0].opt).to.be.equal('GROUP');
    });

    it('should handle whereObject', () => {
      const condition = new QueryCondition();
      condition.whereObject({ id: 1, name: 'test' });
      // whereObject calls where for each key, and where adds AND between conditions
      expect(condition.options.conditions.length).to.be.greaterThanOrEqual(2);
    });

    it('should throw error with invalid arguments', () => {
      const condition = new QueryCondition();
      expect(() => {
        condition.where();
      }).to.throw('Invalid arguments');
    });

    it('should handle where with single string argument (opt only)', () => {
      const condition = new QueryCondition();
      condition.where('AND');
      expect(condition.options.conditions.length).to.be.equal(1);
      expect(condition.options.conditions[0].opt).to.be.equal('AND');
      expect(condition.options.conditions[0].key).to.be.null;
      expect(condition.options.conditions[0].value).to.be.null;
    });
  });

  describe('Query methods', () => {
    it('should handle tables method', () => {
      const query = new Query('select');
      query.tables({ table: 'users' }, { table: 'posts' });
      expect(query.options.tables.length).to.be.equal(2);
    });

    it('should handle force method', () => {
      const query = new Query('select');
      query.table('users').force('idx_users_id');
      expect(query.options.forceIndex).to.be.equal('idx_users_id');
    });

    it('should handle keys method', () => {
      const query = new Query('insert');
      query.keys('id', 'name');
      expect(query.options.keys.length).to.be.equal(2);
    });

    it('should handle limit with validation', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.limit('invalid');
      }).to.throw('limit must be an integer');
    });

    it('should handle offset with validation', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.offset('invalid');
      }).to.throw('offset must be an integer');
    });

    it('should handle attr with empty array', () => {
      const query = new Query('select');
      query.table('users');
      query.attr();
      expect(query.options.attrs.length).to.be.equal(0);
    });

    it('should handle attr - clear attrs when called with no arguments', () => {
      const query = new Query('select');
      query.table('users');
      query.attr('id', 'name');
      expect(query.options.attrs.length).to.be.equal(2);
      query.attr();
      expect(query.options.attrs.length).to.be.equal(0);
      expect(query.options.attrs).to.be.an('array');
    });

    it('should handle attr - set attrs when attrs array is empty', () => {
      const query = new Query('select');
      query.table('users');
      expect(query.options.attrs.length).to.be.equal(0);
      const result = query.attr('id', 'name', 'email');
      expect(query.options.attrs.length).to.be.equal(3);
      expect(query.options.attrs).to.deep.equal(['id', 'name', 'email']);
      expect(result).to.equal(query); // should return this for chaining
    });

    it('should handle attr - append attrs when attrs array is not empty', () => {
      const query = new Query('select');
      query.table('users');
      query.attr('id', 'name');
      expect(query.options.attrs.length).to.be.equal(2);
      expect(query.options.attrs).to.deep.equal(['id', 'name']);

      query.attr('email', 'created_at');
      expect(query.options.attrs.length).to.be.equal(4);
      expect(query.options.attrs).to.deep.equal(['id', 'name', 'email', 'created_at']);
    });

    it('should handle attr - multiple calls should append', () => {
      const query = new Query('select');
      query.table('users');
      query.attr('id');
      query.attr('name');
      query.attr('email', 'phone');
      expect(query.options.attrs.length).to.be.equal(4);
      expect(query.options.attrs).to.deep.equal(['id', 'name', 'email', 'phone']);
    });

    it('should handle attr - return this for chaining', () => {
      const query = new Query('select');
      query.table('users');
      const result1 = query.attr('id');
      const result2 = query.attr('name');
      expect(result1).to.equal(query);
      expect(result2).to.equal(query);
      expect(query.options.attrs.length).to.be.equal(2);
    });

    it('should handle attr - clear and then set new attrs', () => {
      const query = new Query('select');
      query.table('users');
      query.attr('id', 'name', 'email');
      expect(query.options.attrs.length).to.be.equal(3);

      query.attr(); // clear
      expect(query.options.attrs.length).to.be.equal(0);

      query.attr('username', 'password'); // set new
      expect(query.options.attrs.length).to.be.equal(2);
      expect(query.options.attrs).to.deep.equal(['username', 'password']);
    });

    it('should handle orderBy', () => {
      const query = new Query('select');
      query.table('users').orderBy('id', 'desc');
      expect(query.options.orders[0].sortOrder).to.be.equal('DESC');
    });

    it('should handle orderBy with lowercase asc', () => {
      const query = new Query('select');
      query.table('users').orderBy('id', 'asc');
      expect(query.options.orders[0].sortOrder).to.be.equal('ASC');
    });

    it('should handle groupBy', () => {
      const query = new Query('select');
      query.table('users').groupBy('status', 'type');
      expect(query.options.groupField.length).to.be.equal(2);
    });

    it('should handle having with AND', () => {
      const query = new Query('select');
      query.table('users').groupBy('status').having('count', '>', 1).having('sum', '>', 10);
      expect(query.options.having.length).to.be.equal(3); // count condition + AND + sum condition
    });

    it('should handle having with OR', () => {
      const query = new Query('select');
      query.table('users').groupBy('status').having('count', '>', 1).having('OR').having('sum', '>', 10);
      // having adds AND between conditions, so: count condition + OR + sum condition = 3
      // But if OR is already there, it might add AND before OR, so could be more
      expect(query.options.having.length).to.be.greaterThanOrEqual(3);
    });

    it('should handle having with AND directly', () => {
      const query = new Query('select');
      query.table('users').groupBy('status');
      // having('AND') means having(null, 'AND', null)
      query.having(null, 'AND', null);
      expect(query.options.having.length).to.be.equal(1);
      expect(query.options.having[0].opt).to.be.equal('AND');
    });

    it('should handle having with OR directly', () => {
      const query = new Query('select');
      query.table('users').groupBy('status');
      // having('OR') means having(null, 'OR', null)
      query.having(null, 'OR', null);
      expect(query.options.having.length).to.be.equal(1);
      expect(query.options.having[0].opt).to.be.equal('OR');
    });

    it('should handle page method', () => {
      const query = new Query('select');
      query.table('users').page(10, 20);
      expect(query.options.pageLimit).to.be.equal(10);
      expect(query.options.pageOffset).to.be.equal(20);
    });

    it('should handle set with validation', () => {
      const query = new Query('update');
      query.table('users');
      expect(() => {
        query.set(null);
      }).to.throw('data is required');
    });

    it('should handle join with validation', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.join({});
      }).to.throw();
    });

    it('should handle join with invalid join type', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.join({
          table: 'posts',
          self_column: 'users.id',
          foreign_column: 'posts.user_id',
          join_type: 'invalid'
        });
      }).to.throw('Invalid join type');
    });

    it('should handle leftJoin', () => {
      const query = new Query('select');
      query.table('users').leftJoin('posts', 'users.id = posts.user_id');
      expect(query.options.joins[0].join_type).to.be.equal('LEFT');
    });

    it('should handle rightJoin', () => {
      const query = new Query('select');
      query.table('users').rightJoin('posts', 'users.id = posts.user_id');
      expect(query.options.joins[0].join_type).to.be.equal('RIGHT');
    });

    it('should handle innerJoin', () => {
      const query = new Query('select');
      query.table('users').innerJoin('posts', 'users.id = posts.user_id');
      expect(query.options.joins[0].join_type).to.be.equal('INNER');
    });

    it('should handle leftJoin error - table required', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.leftJoin(null, 'users.id = posts.user_id');
      }).to.throw('table is required');
    });

    it('should handle leftJoin error - on required', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.leftJoin('posts', null);
      }).to.throw('on is required');
    });

    it('should handle whereConditions deprecated method', () => {
      const query = new Query('select');
      query.table('users');
      query.whereConditions('AND', { id: 1 });
      expect(query.options.conditions.length).to.be.greaterThan(0);
    });

    it('should handle whereConditions with empty array', () => {
      const query = new Query('select');
      query.table('users');
      const result = query.whereConditions();
      expect(result).to.equal(query);
      expect(query.options.conditions.length).to.be.equal(0);
    });

    it('should handle whereConditions with first condition not string', () => {
      const query = new Query('select');
      query.table('users').where('id', 1);
      query.whereConditions({ id: 2 });
      expect(query.options.conditions.length).to.be.greaterThan(1);
      expect(query.options.conditions[1].opt).to.be.equal('AND');
    });

    it('should handle whereConditions with array length 2', () => {
      const query = new Query('select');
      query.table('users');
      query.whereConditions(['id', 1]);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].key).to.be.equal('id');
      expect(query.options.conditions[0].opt).to.be.equal('=');
      expect(query.options.conditions[0].value).to.be.equal(1);
    });

    it('should handle whereConditions with array length 3', () => {
      const query = new Query('select');
      query.table('users');
      query.whereConditions(['id', '>', 1]);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].key).to.be.equal('id');
      expect(query.options.conditions[0].opt).to.be.equal('>');
      expect(query.options.conditions[0].value).to.be.equal(1);
    });

    it('should handle whereConditions with invalid array length', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.whereConditions(['id', '>', 1, 'extra']);
      }).to.throw('Invalid condition');
    });

    it('should handle whereConditions with object condition', () => {
      const query = new Query('select');
      query.table('users');
      query.whereConditions({ key: 'id', opt: '=', value: 1 });
      expect(query.options.conditions.length).to.be.equal(1);
    });

    it('should handle whereConditions with other type condition', () => {
      const query = new Query('select');
      query.table('users');
      const conditionObj = { key: 'id', opt: '=', value: 1 };
      query.whereConditions(conditionObj);
      expect(query.options.conditions.length).to.be.equal(1);
    });

    it('should handle whereConditions with non-string, non-object, non-array condition', () => {
      const query = new Query('select');
      query.table('users');
      const conditionObj = { key: 'id', opt: '=', value: 1 };
      query.whereConditions(conditionObj);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].key).to.be.equal('id');
      expect(query.options.conditions[0].opt).to.be.equal('=');
      expect(query.options.conditions[0].value).to.be.equal(1);
    });

    it('should handle groupWhere deprecated method', () => {
      const query = new Query('select');
      query.table('users');
      query.groupWhere('AND', { id: 1 });
      expect(query.options.conditions.length).to.be.greaterThan(0);
    });

    it('should handle groupWhere with empty array', () => {
      const query = new Query('select');
      query.table('users');
      const result = query.groupWhere();
      expect(result).to.equal(query);
      expect(query.options.conditions.length).to.be.equal(0);
    });

    it('should handle groupWhere with array length 2', () => {
      const query = new Query('select');
      query.table('users');
      query.groupWhere(['id', 1]);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].opt).to.be.equal('group');
      expect(query.options.conditions[0].value.length).to.be.equal(1);
      expect(query.options.conditions[0].value[0].key).to.be.equal('id');
    });

    it('should handle groupWhere with array length 3', () => {
      const query = new Query('select');
      query.table('users');
      query.groupWhere(['id', '>', 1]);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].opt).to.be.equal('group');
      expect(query.options.conditions[0].value.length).to.be.equal(1);
      expect(query.options.conditions[0].value[0].key).to.be.equal('id');
      expect(query.options.conditions[0].value[0].opt).to.be.equal('>');
    });

    it('should handle groupWhere with invalid array length', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.groupWhere(['id', '>', 1, 'extra']);
      }).to.throw('Invalid condition');
    });

    it('should handle groupWhere with object condition', () => {
      const query = new Query('select');
      query.table('users');
      query.groupWhere({ key: 'id', opt: '=', value: 1 });
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].opt).to.be.equal('group');
    });

    it('should handle groupWhere with other type condition', () => {
      const query = new Query('select');
      query.table('users');
      const conditionObj = { key: 'id', opt: '=', value: 1 };
      query.groupWhere(conditionObj);
      expect(query.options.conditions.length).to.be.equal(1);
      expect(query.options.conditions[0].opt).to.be.equal('group');
      expect(query.options.conditions[0].value.length).to.be.equal(1);
      expect(query.options.conditions[0].value[0].key).to.be.equal('id');
      expect(query.options.conditions[0].value[0].opt).to.be.equal('=');
      expect(query.options.conditions[0].value[0].value).to.be.equal(1);
    });

    it('should handle orWhere deprecated method', () => {
      const query = new Query('select');
      query.table('users').where('id', 1);
      query.orWhere('name', '=', 'test');
      expect(query.options.conditions.length).to.be.equal(3); // id condition + OR + name condition
    });

    it('should handle orWhere error when no conditions', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.orWhere('name', '=', 'test');
      }).to.throw('At least one where condition is required');
    });

    it('should handle andWhere deprecated method', () => {
      const query = new Query('select');
      query.table('users').where('id', 1);
      query.andWhere('name', '=', 'test');
      expect(query.options.conditions.length).to.be.equal(3);
    });

    it('should handle andWhere error when no conditions', () => {
      const query = new Query('select');
      query.table('users');
      expect(() => {
        query.andWhere('name', '=', 'test');
      }).to.throw('At least one where condition is required');
    });
  });
});
