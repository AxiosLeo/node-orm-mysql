'use strict';

const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { _validate } = require('./utils');
const { QueryHandler, Query } = require('./operator');
const { _query } = require('./utils');

const clients = {};

/**
 * initialize client
 * @param {mysql.ConnectionOptions} options
 * @returns {mysql.Connection}
 */
const createClient = (options, name = null) => {
  _validate(options, {
    host: 'required|string',
    user: 'required|string',
    password: 'required|string',
    port: 'required|integer',
    database: 'required|string',
  });
  const key = name ? name :
    `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
  if (clients[key]) {
    return clients[key];
  }
  clients[key] = mysql.createConnection(options);
  clients[key].connect();
  return clients[key];
};

/**
 * @param {mysql.ConnectionOptions} options 
 * @param {string|null} name 
 * @returns {mysqlPromise.Connection}
 */
const createPromiseClient = async (options, name = null) => {
  _validate(options, {
    host: 'required|string',
    user: 'required|string',
    password: 'required|string',
    port: 'required|integer',
    database: 'required|string',
  });
  const key = name ? name :
    `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
  if (clients[key]) {
    return clients[key];
  }
  clients[key] = await mysqlPromise.createConnection(options);
  return clients[key];
};

/**
 * create pool
 * @param {mysql.PoolOptions} options
 * @returns {mysql.Pool}
 */
const createPool = (options, name = null) => {
  _validate(options, {
    host: 'required|string',
    user: 'required|string',
    password: 'required|string',
    port: 'required|integer',
    database: 'required|string',
  });
  const key = name ? name :
    `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
  if (clients[key]) {
    return clients[key];
  }
  const pool = mysql.createPool(options);
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
   */
  constructor(options, name = 'default') {
    const conn = createClient(options, name);
    super(conn);
    this.database = options.database;
  }

  async existTable(table, database = null) {
    if (!table) {
      throw new Error('table name is required');
    }
    const c = await this.table('information_schema.TABLES')
      .where('TABLE_SCHEMA', database || this.database)
      .where('TABLE_NAME', table)
      .count();
    return !!c;
  }

  async existDatabase(database) {
    const c = await this.table('information_schema.SCHEMATA')
      .where('SCHEMA_NAME', database)
      .count();
    return !!c;
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

module.exports = {
  MySQLClient,

  getClient,
  createPool,
  createClient,
  createPromiseClient
};
