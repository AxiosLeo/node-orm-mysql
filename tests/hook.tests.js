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

  it('should handle register method', () => {
    let called = false;
    const callback = () => {
      called = true;
    };
    Hook.register(callback, 'custom', 'event', 'path');
    Hook.trigger(['custom', 'event', 'path']);
    expect(called).to.be.true;
  });

  it('should handle special keys __proto__, constructor, prototype', () => {
    let called = false;
    const callback = () => {
      called = true;
    };
    Hook.register(callback, 'pre', '__proto__', 'test');
    Hook.trigger(['pre', '__proto__', 'test']);
    expect(called).to.be.true;

    called = false;
    Hook.register(callback, 'pre', 'constructor', 'test');
    Hook.trigger(['pre', 'constructor', 'test']);
    expect(called).to.be.true;

    called = false;
    Hook.register(callback, 'pre', 'prototype', 'test');
    Hook.trigger(['pre', 'prototype', 'test']);
    expect(called).to.be.true;
  });

  it('should handle wildcard paths', () => {
    let wildcardCalled = false;
    let specificCalled = false;
    
    const wildcardCallback = () => {
      wildcardCalled = true;
    };
    const specificCallback = () => {
      specificCalled = true;
    };
    
    Hook.register(wildcardCallback, 'pre', '*', 'test');
    Hook.register(specificCallback, 'pre', 'users', 'test');
    
    Hook.trigger(['pre', 'users', 'test']);
    expect(wildcardCalled).to.be.true;
    expect(specificCalled).to.be.true;
  });

  it('should handle eventRecur termination', () => {
    let called = false;
    const callback = (...args) => {
      called = true;
      expect(args.length).to.be.equal(2);
      expect(args[0]).to.be.equal('arg1');
      expect(args[1]).to.be.equal('arg2');
    };
    Hook.register(callback, 'test', 'event');
    Hook.trigger(['test', 'event'], 'arg1', 'arg2');
    expect(called).to.be.true;
  });

  it('should handle listen with trigger', () => {
    let callCount = 0;
    const callback = (...args) => {
      callCount++;
      if (callCount === 1) {
        expect(args.length).to.be.equal(1);
        expect(args[0]).to.be.equal('data');
      }
    };
    Hook.pre(callback, { table: 'users', opt: 'select' });
    Hook.listen({ label: 'pre', table: 'users', opt: 'select' }, 'data');
    expect(callCount).to.be.greaterThanOrEqual(1);
  });
});
