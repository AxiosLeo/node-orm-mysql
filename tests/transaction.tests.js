'use strict';

let expect = null;
const { TransactionOperator, TransactionHandler } = require('../src/transaction');

describe('transaction test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  describe('TransactionOperator', () => {
    it('should create TransactionOperator with default driver', () => {
      const conn = {
        query: () => { },
        execute: () => { }
      };
      const options = {
        driver: 'mysql'
      };
      const operator = new TransactionOperator(conn, options);
      expect(operator).to.be.instanceOf(TransactionOperator);
      expect(operator.options.transaction).to.be.true;
      expect(operator.options.driver).to.be.equal('mysql');
    });

    it('should create TransactionOperator with custom driver and queryHandler', () => {
      const conn = {};
      const options = {
        driver: 'custom',
        queryHandler: async () => {
          return [{ id: 1 }];
        }
      };
      const operator = new TransactionOperator(conn, options);
      expect(operator).to.be.instanceOf(TransactionOperator);
      expect(operator.options.driver).to.be.equal('custom');
    });

    it('should throw error when custom driver without queryHandler', () => {
      const conn = {};
      const options = {
        driver: 'custom'
      };
      expect(() => {
        new TransactionOperator(conn, options);
      }).to.throw('queryHandler is required');
    });

    it('should throw error when queryHandler is not a function', () => {
      const conn = {};
      const options = {
        driver: 'custom',
        queryHandler: 'not a function'
      };
      expect(() => {
        new TransactionOperator(conn, options);
      }).to.throw('queryHandler must be a function');
    });

    it('should append suffix', () => {
      const conn = {
        query: () => { },
        execute: () => { }
      };
      const options = {
        driver: 'mysql'
      };
      const operator = new TransactionOperator(conn, options);
      operator.table('users');
      operator.append('FOR UPDATE');
      expect(operator.options.suffix).to.be.equal('FOR UPDATE');
    });

    it('should append null suffix', () => {
      const conn = {
        query: () => { },
        execute: () => { }
      };
      const options = {
        driver: 'mysql'
      };
      const operator = new TransactionOperator(conn, options);
      operator.table('users');
      operator.append(null);
      expect(operator.options.suffix).to.be.null;
    });
  });

  describe('TransactionHandler', () => {
    it('should create TransactionHandler with default level', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      expect(handler.level).to.be.equal('SERIALIZABLE');
      expect(handler.isbegin).to.be.false;
    });

    it('should create TransactionHandler with full level name', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn, { level: 'READ UNCOMMITTED' });
      expect(handler.level).to.be.equal('READ UNCOMMITTED');
    });

    it('should create TransactionHandler with abbreviated level RU', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn, { level: 'RU' });
      expect(handler.level).to.be.equal('READ UNCOMMITTED');
    });

    it('should create TransactionHandler with abbreviated level RC', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn, { level: 'RC' });
      expect(handler.level).to.be.equal('READ COMMITTED');
    });

    it('should create TransactionHandler with abbreviated level RR', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn, { level: 'RR' });
      expect(handler.level).to.be.equal('REPEATABLE READ');
    });

    it('should create TransactionHandler with abbreviated level S', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn, { level: 'S' });
      expect(handler.level).to.be.equal('SERIALIZABLE');
    });

    it('should throw error with invalid level', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      expect(() => {
        new TransactionHandler(conn, { level: 'INVALID' });
      }).to.throw('Invalid transaction level: INVALID');
    });

    it('should execute query', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1 }]);
        },
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          return [[{ id: 1 }]];
        }
      };
      const handler = new TransactionHandler(conn);
      const result = await handler.query({
        sql: 'SELECT * FROM users',
        values: []
      });
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should handle query error', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(new Error('Query error'), null);
        },
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          throw new Error('Query error');
        }
      };
      const handler = new TransactionHandler(conn);
      try {
        await handler.query({
          sql: 'SELECT * FROM users',
          values: []
        });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Query error');
      }
    });

    it('should execute SQL with values', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          return [[{ id: 1, name: 'test' }]];
        }
      };
      const handler = new TransactionHandler(conn);
      const result = await handler.execute('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).to.be.an('array');
      expect(result[0][0].id).to.be.equal(1);
      expect(result[0][0].name).to.be.equal('test');
    });

    it('should get last insert id', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          return [[{ insert_id: 123 }]];
        }
      };
      const handler = new TransactionHandler(conn);
      const id = await handler.lastInsertId();
      expect(id).to.be.equal(123);
    });

    it('should get last insert id with custom alias', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          return [[{ custom_id: 456 }]];
        }
      };
      const handler = new TransactionHandler(conn);
      const id = await handler.lastInsertId('custom_id');
      expect(id).to.be.equal(456);
    });

    it('should return 0 when last insert id is null', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          return [[null]];
        }
      };
      const handler = new TransactionHandler(conn);
      const id = await handler.lastInsertId();
      expect(id).to.be.equal(0);
    });

    it('should begin transaction', async () => {
      let isolationLevelSet = false;
      let transactionBegun = false;
      const conn = {
        beginTransaction: async () => {
          transactionBegun = true;
        },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          if (sql.includes('SET TRANSACTION ISOLATION LEVEL')) {
            isolationLevelSet = true;
          }
          return [];
        }
      };
      const handler = new TransactionHandler(conn, { level: 'READ COMMITTED' });
      await handler.begin();
      expect(handler.isbegin).to.be.true;
      expect(isolationLevelSet).to.be.true;
      expect(transactionBegun).to.be.true;
    });

    it('should throw error when table called before begin', () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      expect(() => {
        handler.table('users');
      }).to.throw('Transaction is not begin');
    });

    it('should upsert row', async () => {
      let countCalled = false;
      let updateCalled = false;
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          if (sql.includes('COUNT(*)')) {
            countCalled = true;
            return [[{ count: 1 }]];
          }
          if (sql.includes('UPDATE')) {
            updateCalled = true;
            return [{ affectedRows: 1 }];
          }
          return [];
        },
        query: (opt, callback) => {
          if (opt.sql && opt.sql.includes('COUNT(*)')) {
            callback(null, [{ count: 1 }]);
          } else if (opt.sql && opt.sql.includes('UPDATE')) {
            callback(null, { affectedRows: 1 });
          } else {
            callback(null, []);
          }
        }
      };
      const handler = new TransactionHandler(conn);
      await handler.begin();
      const result = await handler.upsert('users', { name: 'test' }, { id: 1 });
      expect(countCalled).to.be.true;
      expect(updateCalled).to.be.true;
      expect(result).to.be.an('object');
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should upsert row with insert path when count is 0', async () => {
      let countCalled = false;
      let insertCalled = false;
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async (sql, values) => {
          if (sql.includes('COUNT(*)')) {
            countCalled = true;
            return [[{ count: 0 }]];
          }
          if (sql.includes('INSERT')) {
            insertCalled = true;
            return [{ affectedRows: 1, insertId: 123 }];
          }
          return [];
        },
        query: (opt, callback) => {
          if (opt.sql && opt.sql.includes('COUNT(*)')) {
            callback(null, [{ count: 0 }]);
          } else if (opt.sql && opt.sql.includes('INSERT')) {
            callback(null, { affectedRows: 1, insertId: 123 });
          } else {
            callback(null, []);
          }
        }
      };
      const handler = new TransactionHandler(conn);
      await handler.begin();
      const result = await handler.upsert('users', { name: 'test' }, { id: 999 });
      expect(countCalled).to.be.true;
      expect(insertCalled).to.be.true;
      expect(result).to.be.an('object');
      expect(result.affectedRows).to.be.equal(1);
      expect(result.insertId).to.be.equal(123);
    });

    it('should commit transaction', async () => {
      let committed = false;
      const conn = {
        beginTransaction: async () => { },
        commit: async () => {
          committed = true;
        },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      await handler.begin();
      await handler.commit();
      expect(committed).to.be.true;
    });

    it('should throw error when commit called before begin', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      try {
        await handler.commit();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Transaction is not begin');
      }
    });

    it('should rollback transaction', async () => {
      let rolledBack = false;
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => {
          rolledBack = true;
        },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      await handler.begin();
      await handler.rollback();
      expect(rolledBack).to.be.true;
    });

    it('should throw error when rollback called before begin', async () => {
      const conn = {
        beginTransaction: async () => { },
        commit: async () => { },
        rollback: async () => { },
        execute: async () => { }
      };
      const handler = new TransactionHandler(conn);
      try {
        await handler.rollback();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Transaction is not begin');
      }
    });
  });
});

