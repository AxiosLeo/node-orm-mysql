'use strict';

const mm = require('mm');
const expect = require('chai').expect;
const mysql = require('mysql2');
const { QueryHandler } = require('../src/query');

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
});
