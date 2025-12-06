'use strict';

let expect = null;
const { Builder } = require('../src/builder');
const { QueryOperator, QueryHandler, QueryCondition } = require('../src/operator');
const { TransactionHandler } = require('../src/transaction');

describe('operator test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });
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

  describe('QueryOperator methods', () => {
    it('should use buildSql deprecated method', () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const builder = operator.buildSql('select');
      expect(builder).to.be.instanceOf(Builder);
      expect(builder.sql).to.be.equal('SELECT * FROM `users`');
    });

    it('should use explain method', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1 }]);
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.explain('select');
      expect(result).to.be.an('array');
    });

    it('should throw error when operator is invalid', async () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      operator.options.operator = null;
      try {
        await operator.exec();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('Invalid operator');
      }
    });

    it('should throw error when connection is null', async () => {
      const operator = new QueryOperator(null);
      operator.table('users');
      operator.options.operator = 'select';
      try {
        await operator.exec();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Connection is null');
      }
    });

    it('should handle select with attrs', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1, name: 'test' }]);
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.select('id', 'name');
      expect(result).to.be.an('array');
    });

    it('should handle update with data', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 1 });
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users').where('id', 1);
      const result = await operator.update({ name: 'test' });
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should handle insert with keys', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 1 });
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.insert({ id: 1, name: 'test' }, ['id']);
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should throw error when insert data is not object', async () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      operator.options.data = null;
      try {
        await operator.insert(null);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('data must be an object');
      }
    });

    it('should handle insertAll', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 2 });
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.insertAll([
        { name: 'test1' },
        { name: 'test2' }
      ]);
      expect(result.affectedRows).to.be.equal(2);
    });

    it('should throw error when insertAll data is not array', async () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      operator.options.data = {};
      try {
        await operator.insertAll();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('data must be an array');
      }
    });

    it('should handle delete with id', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 1 });
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.delete(1);
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should handle delete with custom index field', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 1 });
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.delete(1, 'user_id');
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should handle upsertRow with QueryCondition', async () => {
      const conn = {
        query: (opt, callback) => {
          if (opt.sql && opt.sql.includes('COUNT(*)')) {
            callback(null, [{ count: 1 }]);
          } else {
            callback(null, { affectedRows: 1 });
          }
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const condition = new QueryCondition();
      condition.where('id', 1);
      const result = await operator.upsertRow({ name: 'test' }, condition);
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should handle upsertRow with object condition', async () => {
      const conn = {
        query: (opt, callback) => {
          if (opt.sql && opt.sql.includes('COUNT(*)')) {
            callback(null, [{ count: 0 }]);
          } else {
            callback(null, { affectedRows: 1 });
          }
        }
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      const result = await operator.upsertRow({ name: 'test' }, { id: 1 });
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should throw error when upsertRow table is missing', async () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      try {
        await operator.upsertRow({ name: 'test' }, { id: 1 });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('table is required');
      }
    });

    it('should handle notExec', async () => {
      const conn = {
        query: () => {}
      };
      const operator = new QueryOperator(conn);
      operator.table('users');
      operator.options.operator = 'select';
      operator.notExec();
      const builder = await operator.exec();
      expect(builder).to.be.instanceOf(Builder);
    });

    it('should throw error when custom driver without queryHandler', () => {
      const conn = {};
      expect(() => {
        new QueryOperator(conn, { driver: 'custom' });
      }).to.throw('queryHandler is required');
    });

    it('should throw error when queryHandler is not a function', () => {
      const conn = {};
      expect(() => {
        new QueryOperator(conn, {
          driver: 'custom',
          queryHandler: 'not a function'
        });
      }).to.throw('queryHandler must be a function');
    });
  });

  describe('QueryHandler methods', () => {
    it('should throw error when query opt is missing', async () => {
      const conn = {
        query: () => {}
      };
      const handler = new QueryHandler(conn);
      try {
        await handler.query();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('opt is required');
      }
    });

    it('should handle query', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1 }]);
        }
      };
      const handler = new QueryHandler(conn);
      const result = await handler.query({
        sql: 'SELECT * FROM users',
        values: []
      });
      expect(result).to.be.an('array');
    });

    it('should handle tables', () => {
      const conn = {
        query: () => {}
      };
      const handler = new QueryHandler(conn);
      const operator = handler.tables({ table: 'users' }, { table: 'posts' });
      expect(operator.options.tables.length).to.be.equal(2);
    });

    it('should handle upsert deprecated method', async () => {
      const conn = {
        query: (opt, callback) => {
          if (opt.sql && opt.sql.includes('COUNT(*)')) {
            callback(null, [{ count: 1 }]);
          } else {
            callback(null, { affectedRows: 1 });
          }
        }
      };
      const handler = new QueryHandler(conn);
      handler.database = 'test_db';
      const result = await handler.upsert('users', { name: 'test' }, { id: 1 });
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should handle existTable', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ count: 1 }]);
        }
      };
      const handler = new QueryHandler(conn);
      handler.database = 'test_db';
      const exists = await handler.existTable('users');
      expect(exists).to.be.true;
    });

    it('should handle existTable with database parameter', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ count: 0 }]);
        }
      };
      const handler = new QueryHandler(conn);
      handler.database = 'test_db';
      const exists = await handler.existTable('users', 'other_db');
      expect(exists).to.be.false;
    });

    it('should throw error when existTable table is missing', async () => {
      const conn = {
        query: () => {}
      };
      const handler = new QueryHandler(conn);
      try {
        await handler.existTable();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('table name is required');
      }
    });

    it('should handle existDatabase', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ count: 1 }]);
        }
      };
      const handler = new QueryHandler(conn);
      const exists = await handler.existDatabase('test_db');
      expect(exists).to.be.true;
    });

    it('should handle getTableFields without attrs', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ column_name: 'id', data_type: 'int' }]);
        }
      };
      const handler = new QueryHandler(conn);
      const fields = await handler.getTableFields('test_db', 'users');
      expect(fields).to.be.an('array');
    });

    it('should handle getTableFields with attrs', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ column_name: 'id' }]);
        }
      };
      const handler = new QueryHandler(conn);
      const fields = await handler.getTableFields('test_db', 'users', 'column_name');
      expect(fields).to.be.an('array');
    });
  });
});
