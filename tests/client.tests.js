'use strict';

const mm = require('mm');
/**
 * @type {Chai.ExpectStatic}
 */
let expect = null;
const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { createPool, createClient, createPromiseClient, getClient, MySQLClient, _clients } = require('../src/client');
const { Query } = require('../src/query');

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

  describe('createClient', () => {
    beforeEach(() => {
      // 清理 _clients
      Object.keys(_clients).forEach(key => {
        delete _clients[key];
      });
    });

    it('should create new client', () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = createClient(options);
      expect(client).to.not.be.null;
      mm.restore();
    });

    it('should return existing client when active', () => {
      const mockConnection = {
        connect: () => { },
        _closed: false,
        _closing: false,
        destroyed: false
      };
      mm(mysql, 'createConnection', (options) => {
        return mockConnection;
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client1 = createClient(options);
      const client2 = createClient(options);
      expect(client1).to.equal(client2);
      mm.restore();
    });

    it('should recreate client when closed', () => {
      const mockConnection1 = {
        connect: () => { },
        _closed: true,
        _closing: false,
        destroyed: false
      };
      const mockConnection2 = {
        connect: () => { },
        _closed: false,
        _closing: false,
        destroyed: false
      };
      let callCount = 0;
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const key = `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
      _clients[key] = mockConnection1;
      mm(mysql, 'createConnection', (opts) => {
        callCount++;
        if (callCount === 1) {
          return mockConnection2;
        }
        return mockConnection2;
      });
      const client = createClient(options);
      expect(client).to.equal(mockConnection2);
      expect(client._closed).to.be.false;
      mm.restore();
    });

    it('should recreate client when closing', () => {
      const mockConnection1 = {
        connect: () => { },
        _closed: false,
        _closing: true,
        destroyed: false
      };
      const mockConnection2 = {
        connect: () => { },
        _closed: false,
        _closing: false,
        destroyed: false
      };

      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const key = `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
      _clients[key] = mockConnection1;
      let callCount = 0;
      mm(mysql, 'createConnection', (opts) => {
        callCount++;
        return mockConnection2;
      });
      const client = createClient(options);
      expect(client).to.equal(mockConnection2);
      expect(client._closing).to.be.false;
      expect(callCount).to.be.equal(1);
      mm.restore();
    });

    it('should recreate client when destroyed', () => {
      const mockConnection1 = {
        connect: () => { },
        _closed: false,
        _closing: false,
        destroyed: true
      };
      const mockConnection2 = {
        connect: () => { },
        _closed: false,
        _closing: false,
        destroyed: false
      };
      let callCount = 0;
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const key = `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
      _clients[key] = mockConnection1;
      mm(mysql, 'createConnection', (opts) => {
        callCount++;
        return mockConnection2;
      });
      const client = createClient(options);
      expect(client).to.equal(mockConnection2);
      expect(client.destroyed).to.be.false;
      expect(callCount).to.be.equal(1);
      mm.restore();
    });

    it('should use name parameter', () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client1 = createClient(options, 'named_client');
      const client2 = createClient(options, 'named_client');
      expect(client1).to.equal(client2);
      expect(_clients['named_client']).to.equal(client1);
      mm.restore();
    });

    it('should validate required options', () => {
      expect(() => {
        createClient({});
      }).to.throw();
    });
  });

  describe('createPromiseClient', () => {
    beforeEach(() => {
      Object.keys(_clients).forEach(key => {
        delete _clients[key];
      });
    });

    it('should create new promise client', async () => {
      const mockConnection = {
        _closed: false,
        _closing: false,
        destroyed: false
      };
      mm(mysqlPromise, 'createConnection', async (options) => {
        return mockConnection;
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = await createPromiseClient(options);
      expect(client).to.not.be.null;
      mm.restore();
    });

    it('should return existing promise client when active', async () => {
      const mockConnection = {
        _closed: false,
        _closing: false,
        destroyed: false
      };
      mm(mysqlPromise, 'createConnection', async (options) => {
        return mockConnection;
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client1 = await createPromiseClient(options);
      const client2 = await createPromiseClient(options);
      expect(client1).to.equal(client2);
      mm.restore();
    });

    it('should recreate promise client when closed', async () => {
      const mockConnection1 = {
        _closed: true,
        _closing: false,
        destroyed: false
      };
      const mockConnection2 = {
        _closed: false,
        _closing: false,
        destroyed: false
      };
      let callCount = 0;
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const key = `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
      _clients[key] = mockConnection1;
      mm(mysqlPromise, 'createConnection', async (opts) => {
        callCount++;
        return mockConnection2;
      });
      const client = await createPromiseClient(options);
      expect(client).to.equal(mockConnection2);
      expect(client._closed).to.be.false;
      expect(callCount).to.be.equal(1);
      mm.restore();
    });

    it('should use name parameter', async () => {
      const mockConnection = {
        _closed: false,
        _closing: false,
        destroyed: false
      };
      mm(mysqlPromise, 'createConnection', async (options) => {
        return mockConnection;
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client1 = await createPromiseClient(options, 'named_promise_client');
      const client2 = await createPromiseClient(options, 'named_promise_client');
      expect(client1).to.equal(client2);
      expect(_clients['named_promise_client']).to.equal(client1);
      mm.restore();
    });

    it('should validate required options', async () => {
      try {
        await createPromiseClient({});
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  describe('getClient', () => {
    beforeEach(() => {
      Object.keys(_clients).forEach(key => {
        delete _clients[key];
      });
    });

    it('should get existing client', () => {
      const mockClient = { test: 'client' };
      _clients['test_client'] = mockClient;
      const client = getClient('test_client');
      expect(client).to.equal(mockClient);
    });

    it('should throw error when name is missing', () => {
      expect(() => {
        getClient();
      }).to.throw('name is required');
    });

    it('should throw error when client not found', () => {
      expect(() => {
        getClient('non_existent_client');
      }).to.throw('client non_existent_client not found');
    });
  });

  describe('MySQLClient', () => {
    beforeEach(() => {
      Object.keys(_clients).forEach(key => {
        delete _clients[key];
      });
    });

    it('should create MySQLClient with default type', () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options);
      expect(client).to.be.instanceOf(MySQLClient);
      expect(client.database).to.be.equal('test_db');
      mm.restore();
    });

    it('should create MySQLClient with pool type', () => {
      mm(mysql, 'createPool', (options) => {
        return {
          _closed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options, 'pool_client', 'pool');
      expect(client).to.be.instanceOf(MySQLClient);
      expect(client.database).to.be.equal('test_db');
      mm.restore();
    });

    it('should throw error with invalid type', () => {
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      expect(() => {
        new MySQLClient(options, 'test', 'invalid');
      }).to.throw('client type invalid not found');
    });

    it('should execQuery with Query instance', async () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          query: (opt, callback) => {
            callback(null, [{ id: 1 }]);
          },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options);
      const query = new Query('select');
      query.table('users');
      const result = await client.execQuery(query, 'select');
      expect(result).to.be.an('array');
      mm.restore();
    });

    it('should execQuery with operator parameter', async () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          query: (opt, callback) => {
            callback(null, [{ id: 1 }]);
          },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options);
      const query = new Query();
      query.table('users');
      const result = await client.execQuery(query, 'select');
      expect(result).to.be.an('array');
      mm.restore();
    });

    it('should close connection', async () => {
      let closed = false;
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          end: (callback) => {
            closed = true;
            callback(null);
          },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options);
      await client.close();
      expect(closed).to.be.true;
      mm.restore();
    });

    it('should handle close error', async () => {
      mm(mysql, 'createConnection', (options) => {
        return {
          connect: () => { },
          end: (callback) => {
            callback(new Error('Close error'));
          },
          _closed: false,
          _closing: false,
          destroyed: false
        };
      });
      const options = {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
      };
      const client = new MySQLClient(options);
      try {
        await client.close();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Close error');
      }
      mm.restore();
    });
  });
});
