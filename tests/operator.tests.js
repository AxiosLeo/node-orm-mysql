'use strict';

const expect = require('chai').expect;
const { Builder } = require('../src/builder');
const { QueryOperator } = require('../src/operator');

describe('operator test case', () => {
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
      query_handler: (con, options) => {
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
});
