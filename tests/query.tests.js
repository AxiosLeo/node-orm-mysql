'use strict';

const mm = require('mm');
const expect = require('chai').expect;
const mysql = require('mysql2');
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

  it('sql functions', () => {
    const query = hanlder.table('users', '');

    query.attr('id', 'UNIX_TIMESTAMP(deleted_at) AS deleted_at', 'UNIX_TIMESTAMP(expired_at) AS expired_at');

    expect(query.buildSql('select').sql)
      .to.be.equal('SELECT `id`,UNIX_TIMESTAMP(`deleted_at`) AS `deleted_at`,UNIX_TIMESTAMP(`expired_at`) AS `expired_at` FROM `users`');
  });

  it('query json field', () => {
    const query = hanlder.table('users', 'u');
    query.where('u.meta->$.id', 123);
    expect(query.buildSql('select').sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE JSON_EXTRACT(`u`.`meta`, \'$.id\') = ?');
  });

  it('timestamp field', () => {
    const query = hanlder.table('users', 'u');
    const date = new Date();
    query.set({ updated_at: date });
    const res = query.buildSql('update');
    expect(res.sql).to.be.equal('UPDATE `users` AS `u` SET `updated_at` = ?');
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
    expect(res.sql).to.be.equal('SELECT * FROM `users` AS `u` WHERE `u`.`name` IN (SELECT * FROM `users` GROUP BY `u`.`name` HAVING `COUNT(*)` > ?)');
  });
});
