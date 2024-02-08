'use strict';

let expect = null;
const Hook = require('../src/hook');

describe('hook test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  })
  it('pre', () => {
    const callback = (...args) => {
      expect(true).to.be.true;
      expect(args).to.be.an('array');
    };
    const event = Hook.pre(callback, { table: 'test', opt: 'test' });
    expect(event).to.be.an('object');
    expect(event.label).to.equal('pre');
    expect(event.table).to.equal('test');
    expect(event.opt).to.equal('test');
    expect(event.callback).to.equal(callback);

    Hook.trigger('pre', { table: 'test', opt: 'test' }, 1, 2, 3);
  });

  it('post', () => {
    const callback = (...args) => {
      expect(true).to.be.true;
      expect(args).to.be.an('array');
    };
    const event = Hook.post(callback, { table: 'test', opt: 'test' });
    expect(event).to.be.an('object');
    expect(event.label).to.equal('post');
    expect(event.table).to.equal('test');
    expect(event.opt).to.equal('test');
    expect(event.callback).to.equal(callback);

    Hook.trigger('post', { table: 'test', opt: 'test' }, 1, 2, 3);
  });
});
