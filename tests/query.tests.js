'use strict';

const mm = require('mm');
let expect = null;
const mysql = require('mysql2');
const { Builder } = require('../src/builder');
const { QueryHandler, Query } = require('../src/operator');

describe('query test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  })
  /**
   * @type {QueryHandler}
   */
  let handler;
  beforeEach(() => {
    mm(mysql, 'createConnection', (options) => {
      return {};
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
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `meta_items_relationship` AS `mir` LEFT JOIN `meta_items` AS `mi` ON `mi`.`id` = `mir`.`item_child` WHERE `mir`.`item_parent` = ? AND `mir`.`disabled` = ? AND `mi`.`disabled` = ? ORDER BY `mi`.`id` desc');
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

    query = handler.table('users', 'u');
    query.where('u.meta->$.id', [1, 2, 3], 'in');
    const res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_CONTAINS(JSON_ARRAY(?), JSON_EXTRACT(`u`.`meta`, \'$.id\'))');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');
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
    const res = query.where('name', subQuery, 'IN').buildSql('select');
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
    expect(res2.sql).to.be.equal('SELECT `id`,`name` FROM `users` AS `u` LEFT JOIN `(SELECT * FROM `users` WHERE `name` = ?)` AS `sub_query` ON `id` = `sub_query`.`id`');
  });

  it('query with in condition', () => {
    const query = handler.table('users', 'u');
    expect(() => {
      query.where('name', [], 'IN').buildSql('select');
    }).to.be.throw('Value must not be empty for "IN" condition');
  });

  it('having', () => {
    const query = handler.table('users', 'u');
    const subQuery = new Query('select');
    subQuery.table('users').having('COUNT(*)', '>', 1);
    expect(() => {
      query.where('u.name', subQuery, 'IN').buildSql('select');
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
    const query = handler.table('users', 'u').attr(...[]).where('id', 1).whereConditions();
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `id` = ?');
  });

  it('limit&offset', () => {
    const query = handler.table('users', 'u').attr(...[]).where('id', 1).whereConditions().limit(2).offset(1);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `id` = ?  LIMIT 2 OFFSET 1');
  });

  it('attr is sub query', () => {
    let sql = handler.table('orgs', 's1')
      .attr('s1.id', 's1.name', 's1.parent_id', () => {
        const query = new Query('count', '> 0 AS has_children');
        query.table('orgs', 's2').where('s2.parent_id', '`s1`.`id`');
        return query;
      }).buildSql('select').sql;
    expect(sql).to.be.equal('SELECT `s1`.`id`,`s1`.`name`,`s1`.`parent_id`,(SELECT COUNT(*) AS count FROM `orgs` AS `s2` WHERE `s2`.`parent_id` = `s1`.`id`) > 0 AS `has_children` FROM `orgs` AS `s1`');
  });
});
