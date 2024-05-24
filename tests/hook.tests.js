'use strict';

let expect = null;
const Hook = require('../src/hook');

describe('hook test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });
  it('pre', () => {
    const callback = (...args) => {
      expect(true).to.be.true;
      expect(args).to.be.an('array');
    };
    Hook.pre(callback, { table: 'test', opt: 'test' });
    Hook.trigger('pre', { table: 'test', opt: 'test' }, 1, 2, 3);
  });

  it('post', () => {
    const callback = (...args) => {
      expect(true).to.be.true;
      expect(args).to.be.an('array');
    };
    Hook.post(callback, { table: 'test', opt: 'test' });
    Hook.trigger('post', { table: 'test', opt: 'test' }, 1, 2, 3);

    Hook.post(callback, { table: ['test1', 'test2'], opt: ['insert', 'find'] });
  });
});
