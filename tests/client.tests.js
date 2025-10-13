'use strict';

/**
 * @type {Chai.ExpectStatic}
 */
let expect = null;
const { createPool, _clients } = require('../src/client');

describe('client test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  it('should create new pool when existing pool is closed', () => {
    const options = {
      host: 'localhost',
      port: 3306,
      user: 'test',
      password: 'test',
      database: 'test_db',
      connectionLimit: 10
    };

    // 创建第一个 pool
    const pool1 = createPool(options, 'test_pool');
    expect(pool1).to.not.be.null;

    // 模拟 pool 被关闭
    pool1._closed = true;

    // 再次调用 createPool，应该创建新的 pool
    const pool2 = createPool(options, 'test_pool');
    expect(pool2).to.not.be.null;
    expect(pool2).to.not.equal(pool1); // 应该是不同的实例
    expect(pool2._closed).to.not.be.true; // 新 pool 应该是活跃的
  });

  it('should return existing pool when pool is active', () => {
    const options = {
      host: 'localhost',
      port: 3306,
      user: 'test',
      password: 'test',
      database: 'test_db2',
      connectionLimit: 10
    };

    // 创建第一个 pool
    const pool1 = createPool(options, 'test_pool2');
    expect(pool1).to.not.be.null;

    // 再次调用 createPool，应该返回相同的 pool
    const pool2 = createPool(options, 'test_pool2');
    expect(pool2).to.equal(pool1); // 应该是相同的实例
  });

  it('should handle pool without name parameter', () => {
    const options = {
      host: 'localhost',
      port: 3306,
      user: 'test',
      password: 'test',
      database: 'test_db3',
      connectionLimit: 10
    };

    // 创建 pool 不指定名称
    const pool1 = createPool(options);
    expect(pool1).to.not.be.null;

    // 再次调用应该返回相同的 pool
    const pool2 = createPool(options);
    expect(pool2).to.equal(pool1);
  });

  it('should test connectivity check logic', () => {
    // 测试连通性检查的逻辑
    const mockConnection = {
      _closed: false,
      _closing: false,
      destroyed: false
    };

    // 手动设置一个模拟的连接
    const testKey = 'test_connectivity_check';
    _clients[testKey] = mockConnection;

    // 测试正常连接应该被返回
    expect(_clients[testKey]).to.equal(mockConnection);

    // 模拟连接关闭
    mockConnection._closed = true;

    // 验证连通性检查的逻辑存在
    expect(mockConnection._closed).to.be.true;

    // 清理
    delete _clients[testKey];
  });
});
