'use strict';

const expect = require('chai').expect;
const { Hook } = require('../src/hook');

describe('hook test case', () => {
  it('push', () => {
    const callback = () => { };
    const event = Hook.pre(callback, { table: 'test', opt: 'test' });
    expect(event).to.be.an('object');
    expect(event.label).to.equal('pre');
    expect(event.table).to.equal('test');
    expect(event.opt).to.equal('test');
    expect(event.callback).to.equal(callback);
  });
});
