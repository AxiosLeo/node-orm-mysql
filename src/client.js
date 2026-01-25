'use strict';

const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { Client: PgClient, Pool: PgPool } = require('pg');
const { _validate } = require('./utils');
const { _query } = require('./core');
const { QueryHandler } = require('./operator');
const { Query } = require('./query');

const clients = {};

/**
 * initialize client
 * @param {mysql.ConnectionOptions | import('pg').ClientConfig} options
 * @param {string|null} name
 * @returns {mysql.Connection | import('pg').Client}
 */
const createClient = (options, name = null) => {
  const driver = options.driver || 'mysql';

  _validate(options, {
    host: 'required|string',
    port: 'required|integer',
    user: 'required|string',
    password: 'required|string',
    database: 'required|string',
  });

  const key = name ? name :
    `${driver}:${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;

  if (clients[key]) {
    const existingConnection = clients[key];

    if (driver === 'postgre') {
      // PostgreSQL connection check
      if (existingConnection._ending || existingConnection._ended) {
        delete clients[key];
      } else {
        return existingConnection;
      }
    } else {
      // MySQL connection check
      if (existingConnection._closing || existingConnection._closed || existingConnection.destroyed) {
        delete clients[key];
      } else {
        return existingConnection;
      }
    }
  }

  if (driver === 'postgre') {
    // Create PostgreSQL client
    const pgClient = new PgClient({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
    });
    pgClient.connect();
    pgClient._driver = 'postgre';
    clients[key] = pgClient;
    return pgClient;
  }

  // Create MySQL client (default)
  clients[key] = mysql.createConnection(options);
  clients[key].connect();
  clients[key]._driver = 'mysql';
  return clients[key];
};

/**
 * @param {mysql.ConnectionOptions | import('pg').ClientConfig} options 
 * @param {string|null} name 
 * @returns {Promise<mysqlPromise.Connection | import('pg').Client>}
 */
const createPromiseClient = async (options, name = null) => {
  const driver = options.driver || 'mysql';

  _validate(options, {
    host: 'required|string',
    port: 'required|integer',
    user: 'required|string',
    password: 'required|string',
    database: 'required|string',
  });

  const key = name ? name :
    `${driver}:${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;

  if (clients[key]) {
    const existingConnection = clients[key];

    if (driver === 'postgre') {
      if (existingConnection._ending || existingConnection._ended) {
        delete clients[key];
      } else {
        return existingConnection;
      }
    } else {
      if (existingConnection._closing || existingConnection._closed || existingConnection.destroyed) {
        delete clients[key];
      } else {
        return existingConnection;
      }
    }
  }

  if (driver === 'postgre') {
    // PostgreSQL is already promise-based
    const pgClient = new PgClient({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
    });
    await pgClient.connect();
    pgClient._driver = 'postgre';
    clients[key] = pgClient;
    return pgClient;
  }

  // MySQL promise client
  clients[key] = await mysqlPromise.createConnection(options);
  clients[key]._driver = 'mysql';
  return clients[key];
};

/**
 * create pool
 * @param {mysql.PoolOptions | import('pg').PoolConfig} options
 * @returns {mysql.Pool | import('pg').Pool}
 */
const createPool = (options, name = null) => {
  const driver = options.driver || 'mysql';

  _validate(options, {
    host: 'required|string',
    user: 'required|string',
    password: 'required|string',
    port: 'required|integer',
    database: 'required|string',
  });

  const key = name ? name :
    `${driver}:${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;

  if (clients[key]) {
    const existingPool = clients[key];

    if (driver === 'postgre') {
      if (existingPool._ending || existingPool.ending) {
        delete clients[key];
      } else {
        return existingPool;
      }
    } else {
      if (existingPool._closed) {
        delete clients[key];
      } else {
        return existingPool;
      }
    }
  }

  if (driver === 'postgre') {
    // Create PostgreSQL pool
    const pgPool = new PgPool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      max: options.connectionLimit || options.max || 10,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 0,
    });
    pgPool._driver = 'postgre';
    clients[key] = pgPool;
    return pgPool;
  }

  // Create MySQL pool (default)
  const pool = mysql.createPool(options);
  pool._driver = 'mysql';
  clients[key] = pool;
  return pool;
};

/**
 * get client
 * @param {*} name 
 * @returns {mysql.Connection}
 */
const getClient = (name) => {
  if (!name) {
    throw new Error('name is required');
  }
  if (!clients[name]) {
    throw new Error(`client ${name} not found`);
  }
  return clients[name];
};

class MySQLClient extends QueryHandler {

  /**
   * @param {mysql.ConnectionOptions} options 
   * @param {*} name 
   * @param {'default'|'promise'|'pool'} type
   */
  constructor(options, name = 'default', type = 'default') {
    let conn;
    switch (type) {
      case 'default':
        conn = createClient(options, name);
        break;
      case 'pool':
        conn = createPool(options, name);
        break;
      default:
        throw new Error(`client type ${type} not found`);
    }
    super(conn);
    this.database = options.database;
  }

  /**
   * @param {import('./operator').Query} query 
   */
  async execQuery(query, operator = null) {
    if (query instanceof Query) {
      query.options.operator = operator;
      return await _query(this.conn, query.options);
    }
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.conn.end((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

/**
 * PostgreSQL Client class
 */
class PostgreClient extends QueryHandler {

  /**
   * @param {import('pg').ClientConfig | import('pg').PoolConfig} options 
   * @param {*} name 
   * @param {'default'|'pool'} type
   */
  constructor(options, name = 'default', type = 'default') {
    // Ensure driver is set to postgre
    options = { ...options, driver: 'postgre' };

    let conn;
    switch (type) {
      case 'default':
        conn = createClient(options, name);
        break;
      case 'pool':
        conn = createPool(options, name);
        break;
      default:
        throw new Error(`client type ${type} not found`);
    }
    super(conn, { driver: 'postgre' });
    this.database = options.database;
  }

  /**
   * @param {import('./operator').Query} query 
   */
  async execQuery(query, operator = null) {
    if (query instanceof Query) {
      query.options.operator = operator;
      query.options.driver = 'postgre';
      return await _query(this.conn, query.options);
    }
  }

  async close() {
    return this.conn.end();
  }

  /**
   * Check if a table exists in the database
   * @param {string} table 
   * @param {string|null} schema 
   */
  async existTable(table, schema = 'public') {
    const result = await this.conn.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`,
      [schema, table]
    );
    return result.rows[0].exists;
  }

  /**
   * Check if a database exists
   * @param {string} database 
   */
  async existDatabase(database) {
    const result = await this.conn.query(
      'SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)',
      [database]
    );
    return result.rows[0].exists;
  }

  /**
   * Get table columns information
   * @param {string} table 
   * @param {string} schema 
   */
  async getTableFields(schema, table, ...attrs) {
    const columns = attrs.length ? attrs.join(',') : '*';
    const result = await this.conn.query(
      `SELECT ${columns} FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [schema, table]
    );
    return result.rows;
  }
}

module.exports = {
  MySQLClient,
  PostgreClient,

  getClient,
  createPool,
  createClient,
  createPromiseClient,

  // 仅用于测试
  _clients: clients
};
