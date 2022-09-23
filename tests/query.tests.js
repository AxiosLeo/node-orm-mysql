'use strict';

const mm = require('mm');
const expect = require('chai').expect;
const mysql = require('mysql2');
const { Builder } = require('../src/builder');
const { QueryHandler, Query } = require('../src/operator');

describe('query test case', () => {
  let hanlder;
  beforeEach(() => {
    mm(mysql, 'createConnection', (options) => {
      return {};
    });
    const conn = mysql.createConnection({});
    hanlder = new QueryHandler(conn);
  });
  it('select should be ok', () => {
    const query = hanlder.table('users', 'u');
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u`');

    query.where('u.id', 1);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`id` = ?');
  });
  it('join select order should be ok', () => {
    const query = hanlder.table('meta_items_relationship', 'mir')
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
    const query = hanlder.table('meta_items_relationship', 'mir')
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
    const query = hanlder.table('users', '');

    query.attr('id', 'UNIX_TIMESTAMP(deleted_at) AS deleted_at', 'UNIX_TIMESTAMP(expired_at) AS expired_at');

    expect(query.buildSql('select').sql)
      .to.be.equal('SELECT `id`,UNIX_TIMESTAMP(`deleted_at`) AS `deleted_at`,UNIX_TIMESTAMP(`expired_at`) AS `expired_at` FROM `users`');
  });

  it('query json field', () => {
    let query = hanlder.table('users', 'u');
    query.where('u.meta->$.id', 123);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_EXTRACT(`u`.`meta`, \'$.id\') = ?');

    query = hanlder.table('users', 'u');
    query.where('u.meta->$.id', [1, 2, 3], 'in');
    const res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_EXTRACT(`u`.`meta`, \'$.id\') IN (?)');
    expect(JSON.stringify(res.values)).to.be.equal('[[1,2,3]]');
  });

  it('timestamp field', () => {
    const query = hanlder.table('users', 'u');
    const date = new Date();
    query.set({ updated_at: date });
    query.where('id', 1);
    const res = query.buildSql('update');
    expect(res.sql).to.be.equal('UPDATE `users` AS `u` SET `updated_at` = ? WHERE `id` = ?');
  });

  it('sub query', () => {
    const query = hanlder.table('users', 'u');
    const subQuery = new Query('select');
    subQuery.table('users');
    const res = query.where('name', subQuery, 'IN').buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `name` IN (SELECT * FROM `users`)');
  });

  it('having', () => {
    const query = hanlder.table('users', 'u');
    const subQuery = new Query('select');
    subQuery.table('users').having('COUNT(*)', '>', 1);
    expect(() => {
      query.where('u.name', subQuery, 'IN').buildSql('select');
    }).to.be.throw('having is not allowed without "GROUP BY"');

    subQuery.groupBy('u.name');
    const res = query.buildSql('select');
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`name` IN (SELECT * FROM `users` GROUP BY `u`.`name` HAVING COUNT(*) > ?)');
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
    const query = hanlder.table('users', 'u').attr(...[]);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u`');
  });
});
