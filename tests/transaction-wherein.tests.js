'use strict';

/**
 * Regression tests for whereIn / whereNotIn / where(field, 'IN', array)
 * on the transaction path.
 *
 * Background: TransactionOperator sets options.transaction = true, which makes
 * core._query() use conn.execute() (server-side prepared statement) instead of
 * conn.query() (client-side interpolation). Prepared statements bind exactly one
 * scalar per placeholder and never expand arrays, so `IN (?)` bound with [1, 2]
 * silently matched zero rows before the fix. The builder must therefore emit one
 * placeholder per element with flat scalar values.
 */

let expect = null;
const { QueryOperator } = require('../src/operator');
const { TransactionHandler } = require('../src/transaction');

const FIXTURE_ROWS = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
  { id: 3, name: 'carol' }
];

/**
 * Mock of a mysql2/promise connection whose execute() mimics real prepared
 * statement behavior: it never expands array parameters. If a bound value is
 * an array (the old buggy binding), it silently returns an empty result set,
 * exactly like the observed production behavior.
 */
function createMockConn(captured) {
  const evaluate = (sql, values) => {
    const placeholders = (sql.match(/\?/g) || []).length;
    if (placeholders !== values.length || values.some((v) => Array.isArray(v))) {
      return [];
    }
    const m = sql.match(/WHERE `(\w+)` (NOT IN|IN) \((\?(,\?)*)\)/);
    if (!m) {
      return [];
    }
    const field = m[1];
    const isNot = m[2] === 'NOT IN';
    const bound = values.slice(values.length - m[3].split(',').length);
    return FIXTURE_ROWS.filter((row) => isNot ? !bound.includes(row[field]) : bound.includes(row[field]));
  };
  return {
    beginTransaction: async () => { },
    commit: async () => { },
    rollback: async () => { },
    execute: async (sql, values = []) => {
      captured.push({ sql, values });
      if (sql.startsWith('SET TRANSACTION')) {
        return [[]];
      }
      if (sql.startsWith('UPDATE') || sql.startsWith('DELETE')) {
        return [{ affectedRows: evaluate(sql, values).length }];
      }
      return [evaluate(sql, values)];
    }
  };
}

describe('whereIn on transaction path (regression)', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  describe('builder output via notExec()', () => {
    const conn = { query: () => { }, execute: () => { } };

    it('whereIn with array should expand placeholders and bind scalars', async () => {
      const builder = await new QueryOperator(conn)
        .table('users').whereIn('id', [1, 2]).notExec().select();
      expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `id` IN (?,?)');
      expect(builder.values).to.deep.equal([1, 2]);
    });

    it('whereNotIn with array should expand placeholders', async () => {
      const builder = await new QueryOperator(conn)
        .table('users').whereNotIn('id', [1, 2]).notExec().select();
      expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `id` NOT IN (?,?)');
      expect(builder.values).to.deep.equal([1, 2]);
    });

    it('where(field, "IN", array) should behave the same as whereIn', async () => {
      const builder = await new QueryOperator(conn)
        .table('users').where('id', 'IN', [1, 2]).notExec().select();
      expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `id` IN (?,?)');
      expect(builder.values).to.deep.equal([1, 2]);
    });

    it('whereIn with comma separated string should split into scalars', async () => {
      const builder = await new QueryOperator(conn)
        .table('users').whereIn('name', 'alice, bob').notExec().select();
      expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `name` IN (?,?)');
      expect(builder.values).to.deep.equal(['alice', 'bob']);
    });

    it('whereIn with single element array should produce one placeholder', async () => {
      const builder = await new QueryOperator(conn)
        .table('users').whereIn('id', [2]).notExec().select();
      expect(builder.sql).to.be.equal('SELECT * FROM `users` WHERE `id` IN (?)');
      expect(builder.values).to.deep.equal([2]);
    });

    it('whereIn with empty array should still throw', async () => {
      try {
        await new QueryOperator(conn).table('users').whereIn('id', []).notExec().select();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Value must not be empty for "IN" condition');
      }
    });
  });

  describe('TransactionHandler with mocked prepared-statement execute', () => {
    /**
     * @returns {Promise<{tx: TransactionHandler, captured: Array}>}
     */
    const beginTx = async () => {
      const captured = [];
      const tx = new TransactionHandler(createMockConn(captured));
      await tx.begin();
      return { tx, captured };
    };

    it('whereIn SELECT should return matching rows', async () => {
      const { tx, captured } = await beginTx();
      const rows = await tx.table('users').whereIn('id', [1, 2]).select();
      expect(rows).to.have.lengthOf(2);
      expect(rows.map((r) => r.id)).to.deep.equal([1, 2]);
      const last = captured[captured.length - 1];
      expect(last.sql).to.be.equal('SELECT * FROM `users` WHERE `id` IN (?,?)');
      expect(last.values).to.deep.equal([1, 2]);
      last.values.forEach((v) => expect(v).to.not.be.an('array'));
      await tx.rollback();
    });

    it('whereNotIn SELECT should return non-matching rows', async () => {
      const { tx } = await beginTx();
      const rows = await tx.table('users').whereNotIn('id', [1, 2]).select();
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].id).to.be.equal(3);
      await tx.rollback();
    });

    it('where(field, "IN", array) SELECT should return matching rows', async () => {
      const { tx } = await beginTx();
      const rows = await tx.table('users').where('id', 'IN', [2, 3]).select();
      expect(rows).to.have.lengthOf(2);
      await tx.rollback();
    });

    it('whereIn with comma separated string should return matching rows', async () => {
      const { tx, captured } = await beginTx();
      const rows = await tx.table('users').whereIn('name', 'alice,bob').select();
      expect(rows).to.have.lengthOf(2);
      const last = captured[captured.length - 1];
      expect(last.values).to.deep.equal(['alice', 'bob']);
      await tx.rollback();
    });

    it('whereIn with single element array should return one row', async () => {
      const { tx } = await beginTx();
      const rows = await tx.table('users').whereIn('id', [2]).select();
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].name).to.be.equal('bob');
      await tx.rollback();
    });

    it('whereIn UPDATE should affect matching rows', async () => {
      const { tx, captured } = await beginTx();
      const res = await tx.table('users').whereIn('id', [1, 2]).update({ name: 'updated' });
      expect(res.affectedRows).to.be.equal(2);
      const last = captured[captured.length - 1];
      expect(last.sql).to.be.equal('UPDATE `users` SET `name` = ? WHERE `id` IN (?,?)');
      expect(last.values).to.deep.equal(['updated', 1, 2]);
      await tx.commit();
    });

    it('transaction path and non-transaction builder should produce identical sql/values', async () => {
      const { tx, captured } = await beginTx();
      await tx.table('users').whereIn('id', [1, 2]).select();
      const txCall = captured[captured.length - 1];
      const builder = await new QueryOperator({ query: () => { } })
        .table('users').whereIn('id', [1, 2]).notExec().select();
      expect(txCall.sql).to.be.equal(builder.sql);
      expect(txCall.values).to.deep.equal(builder.values);
      await tx.rollback();
    });
  });
});
