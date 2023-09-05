'use strict';

const expect = require('chai').expect;
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
});
