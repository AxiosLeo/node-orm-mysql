'use strict';

let expect = null;
const { _query, _execSQL } = require('../src/core');

describe('core test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  describe('_query function', () => {
    it('should handle empty options with default driver', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1 }]);
        }
      };
      const options = {
        driver: 'mysql',
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should handle transaction mode with execute', async () => {
      const conn = {
        execute: async (sql, values) => {
          return [[{ id: 1 }]];
        }
      };
      const options = {
        driver: 'mysql',
        transaction: true,
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should handle non-transaction mode with query', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, [{ id: 1 }]);
        }
      };
      const options = {
        driver: 'mysql',
        transaction: false,
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should handle custom driver with queryHandler', async () => {
      const conn = {};
      const options = {
        driver: 'custom',
        queryHandler: (con, opts, opt) => {
          return Promise.resolve([{ id: 1, name: 'test' }]);
        },
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
      expect(result[0].name).to.be.equal('test');
    });

    it('should throw error when queryHandler does not return Promise', async () => {
      const conn = {};
      const options = {
        driver: 'custom',
        queryHandler: (con, opts, opt) => {
          return 'not a promise';
        },
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      try {
        await _query(conn, options);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('queryHandler must return a promise');
      }
    });

    it('should handle error in transaction mode', async () => {
      const conn = {
        execute: async (sql, values) => {
          throw new Error('Database error');
        }
      };
      const options = {
        driver: 'mysql',
        transaction: true,
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      try {
        await _query(conn, options);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Database error');
      }
    });

    it('should handle error in non-transaction mode', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(new Error('Query error'), null);
        }
      };
      const options = {
        driver: 'mysql',
        transaction: false,
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      try {
        await _query(conn, options);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Query error');
      }
    });

    it('should handle builder with empty values array', async () => {
      const conn = {
        query: (opt, callback) => {
          expect(opt.values).to.be.an('array');
          callback(null, [{ id: 1 }]);
        }
      };
      const options = {
        driver: 'mysql',
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
    });

    it('should handle transaction mode with empty values', async () => {
      const conn = {
        execute: async (sql, values) => {
          expect(values).to.be.an('array');
          return [[{ id: 1 }]];
        }
      };
      const options = {
        driver: 'mysql',
        transaction: true,
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      const result = await _query(conn, options);
      expect(result).to.be.an('array');
    });

    it('should throw error when queryHandler is not a function', async () => {
      const conn = {};
      const options = {
        driver: 'custom',
        queryHandler: 'not a function',
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      try {
        await _query(conn, options);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('queryHandler must return a promise');
      }
    });

    it('should throw error when queryHandler is missing', async () => {
      const conn = {};
      const options = {
        driver: 'custom',
        operator: 'select',
        tables: [{ table: 'users' }],
        conditions: [],
        orders: [],
        groupField: [],
        having: []
      };
      try {
        await _query(conn, options);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('queryHandler must return a promise');
      }
    });
  });

  describe('_execSQL function', () => {
    it('should use conn.query when available', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(null, { affectedRows: 1 });
        }
      };
      const result = await _execSQL(conn, 'SELECT * FROM users', []);
      expect(result.affectedRows).to.be.equal(1);
    });

    it('should use conn.execute when query is not a function', async () => {
      const conn = {
        execute: async (sql, values) => {
          return [{ id: 1 }];
        }
      };
      const result = await _execSQL(conn, 'SELECT * FROM users', []);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should use conn.execute when query property does not exist', async () => {
      const conn = {
        execute: async (sql, values) => {
          return [{ id: 1 }];
        }
      };
      const result = await _execSQL(conn, 'SELECT * FROM users', []);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should use conn.execute when query is null', async () => {
      const conn = {
        query: null,
        execute: async (sql, values) => {
          return [{ id: 1 }];
        }
      };
      const result = await _execSQL(conn, 'SELECT * FROM users', []);
      expect(result).to.be.an('array');
      expect(result[0].id).to.be.equal(1);
    });

    it('should handle error with conn.query', async () => {
      const conn = {
        query: (opt, callback) => {
          callback(new Error('Query failed'), null);
        }
      };
      try {
        await _execSQL(conn, 'SELECT * FROM users', []);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Query failed');
      }
    });

    it('should handle error with conn.execute', async () => {
      const conn = {
        execute: async (sql, values) => {
          throw new Error('Execute failed');
        }
      };
      try {
        await _execSQL(conn, 'SELECT * FROM users', []);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.be.equal('Execute failed');
      }
    });
  });
});

