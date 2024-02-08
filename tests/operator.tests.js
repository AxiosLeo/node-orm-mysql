'use strict';

let expect = null;
const { Builder } = require('../src/builder');
const { QueryOperator } = require('../src/operator');
const { TransactionHandler } = require('../src/transaction');

describe('operator test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  })
  it('find', async () => {
    const conn = {
      query: async (_, callback) => {
        callback(null, []);
      }
    };
    const operator = new QueryOperator(conn);
    const res = await operator.table('test').select();
    expect(res).to.be.an('array');
  });

  it('custom driver', async () => {
    const conn = {
      query: async (_, callback) => {
        callback(null, []);
      }
    };
    const operator = new QueryOperator(conn, {
      driver: 'custom',
      queryHandler: (con, options) => {
        const builder = new Builder(options);
        expect(builder.sql).to.be.a('string');
        expect(builder.sql).to.be.equal('SELECT * FROM `test`');
        return new Promise((resolve, reject) => {
          resolve([{ a: 1, b: 2 }]);
        });
      }
    });
    const res = await operator.table('test').select();
    expect(res).to.be.an('array');
    expect(res[0].a).to.be.equal(1);
    expect(res[0].b).to.be.equal(2);
  });

  it('transaction', async () => {
    const conn = {
      execute: async (sql, values) => {
        return [[{ insertId: 1 }]];
      },
      beginTransaction: async () => { },
      rollback: async () => { },
      commit: async () => { },
    };
    const transaction = new TransactionHandler(conn, {
      /*
      level = 'READ UNCOMMITTED' | 'RU'
            | 'READ COMMITTED' | 'RC'
            | 'REPEATABLE READ' | 'RR'
            | 'SERIALIZABLE' | 'S'
      */
      level: 'SERIALIZABLE', // 'SERIALIZABLE' as default value
    });
    await transaction.begin();
    try {
      // insert user info
      // will not really create a record.
      let row = await transaction.table('users').insert({
        name: 'Joe',
        age: 18,
      });
      const lastInsertId = row[0].insertId;

      // insert student info
      await transaction.table('students').insert({
        user_id: lastInsertId,
      });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  });
});
