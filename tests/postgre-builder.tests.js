'use strict';

/**
 * @type {Chai.ExpectStatic}
 */
let expect = null;
const { PostgreBuilder, PostgreManageSQLBuilder } = require('../src/postgre-builder');
const { Query } = require('../src/operator');

describe('PostgreBuilder test case', () => {
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
    expect((new PostgreBuilder(options)).sql).to.be.equal('SELECT * FROM "table1" AS "t1"');
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
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "table1" AS "t1" WHERE "t1"."id" = $1 AND $2 OR "id" > $3');
    expect(builder.values).to.have.lengthOf(3);
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
    expect((new PostgreBuilder(options)).sql).to.be.equal('SELECT * FROM "table1" AS "t1" WHERE "t1"."id" = $1  LIMIT 1');
  });

  it('insert should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'insert',
      data: { name: 'test', email: 'test@example.com' },
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('INSERT INTO "users"("name","email") VALUES ($1,$2)');
    expect(builder.values).to.deep.equal(['test', 'test@example.com']);
  });

  it('insert with ON CONFLICT should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'insert',
      data: { id: 1, name: 'test', email: 'test@example.com' },
      keys: ['id'],
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.include('ON CONFLICT ("id") DO UPDATE SET');
    expect(builder.sql).to.include('"name" = EXCLUDED."name"');
    expect(builder.sql).to.include('"email" = EXCLUDED."email"');
  });

  it('update should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'id',
        opt: '=',
        value: 1
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'update',
      data: { name: 'updated' },
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('UPDATE "users" SET "name" = $1 WHERE "id" = $2');
    expect(builder.values).to.deep.equal(['updated', 1]);
  });

  it('delete should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'id',
        opt: '=',
        value: 1
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'delete',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('DELETE FROM "users" WHERE "id" = $1');
  });

  it('count should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'count',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT COUNT(*) AS count FROM "users"');
  });

  it('IS NULL condition should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'deleted_at',
        opt: '=',
        value: null
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "users" WHERE "deleted_at" IS NULL');
  });

  it('IS NOT NULL condition should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'deleted_at',
        opt: '!=',
        value: null
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "users" WHERE "deleted_at" IS NOT NULL');
  });

  it('BETWEEN condition should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'age',
        opt: 'between',
        value: [18, 65]
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "users" WHERE "age" BETWEEN $1 AND $2');
    expect(builder.values).to.deep.equal([18, 65]);
  });

  it('IN condition should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [{
        key: 'status',
        opt: 'in',
        value: ['active', 'pending']
      }],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.include('IN');
  });

  it('ORDER BY should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [{ sortField: 'created_at', sortOrder: 'desc' }],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: []
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "users" ORDER BY "created_at" desc');
  });

  it('LIMIT OFFSET should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'users' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: [],
      pageLimit: 10,
      pageOffset: 20
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.be.equal('SELECT * FROM "users"  LIMIT 10 OFFSET 20');
  });

  it('GROUP BY should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'orders' }],
      operator: 'select',
      data: null,
      groupField: ['status'],
      having: [],
      attrs: ['status', 'COUNT(*) as count']
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.include('GROUP BY "status"');
  });

  it('LEFT JOIN should be ok', () => {
    const options = {
      sql: '',
      values: [],
      conditions: [],
      orders: [],
      tables: [{ table: 'users', alias: 'u' }],
      operator: 'select',
      data: null,
      groupField: [],
      having: [],
      joins: [{
        table: 'orders',
        alias: 'o',
        self_column: 'u.id',
        foreign_column: 'o.user_id',
        join_type: 'left'
      }]
    };
    const builder = new PostgreBuilder(options);
    expect(builder.sql).to.include('LEFT JOIN "orders" AS "o"');
    expect(builder.sql).to.include('ON "u"."id" = "o"."user_id"');
  });
});

describe('PostgreManageSQLBuilder test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  it('create table should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'table',
      name: 'users',
      columns: {
        id: { type: 'int', primaryKey: true, autoIncrement: true },
        name: { type: 'varchar', length: 255 },
        email: { type: 'varchar', length: 255, uniqIndex: true }
      }
    });
    expect(builder.sql).to.include('CREATE TABLE "users"');
    expect(builder.sql).to.include('SERIAL');
    expect(builder.sql).to.include('PRIMARY KEY ("id")');
  });

  it('create index should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'index',
      name: 'idx_users_email',
      table: 'users',
      columns: ['email']
    });
    expect(builder.sql).to.be.equal('CREATE INDEX "idx_users_email" ON "users" ("email")');
  });

  it('create unique index should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'index',
      name: 'idx_users_email_unique',
      table: 'users',
      columns: ['email'],
      unique: true
    });
    expect(builder.sql).to.be.equal('CREATE UNIQUE INDEX "idx_users_email_unique" ON "users" ("email")');
  });

  it('drop table should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'drop',
      target: 'table',
      name: 'users'
    });
    expect(builder.sql).to.be.equal('DROP TABLE "users"');
  });

  it('drop column should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'drop',
      target: 'column',
      name: 'email',
      table: 'users'
    });
    expect(builder.sql).to.be.equal('ALTER TABLE "users" DROP COLUMN "email"');
  });

  it('drop index should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'drop',
      target: 'index',
      name: 'idx_users_email'
    });
    expect(builder.sql).to.be.equal('DROP INDEX "idx_users_email"');
  });

  it('add column should be ok', () => {
    const builder = new PostgreManageSQLBuilder({
      operator: 'create',
      target: 'column',
      table: 'users',
      name: 'phone',
      type: 'varchar',
      length: 20
    });
    expect(builder.sql).to.include('ALTER TABLE "users" ADD COLUMN');
    expect(builder.sql).to.include('"phone"');
    expect(builder.sql).to.include('VARCHAR(20)');
  });
});
