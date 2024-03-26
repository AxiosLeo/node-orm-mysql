'use strict';

const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { _validate } = require('./utils');
const { _query } = require('./core');
const { QueryHandler } = require('./operator');
const { Query } = require('./query');

const clients = {};

/**
 * initialize client
 * @param {mysql.ConnectionOptions} options
 * @returns {mysql.Connection}
 */
const createClient = (options, name = null) => {
  _validate(options, {
    host: 'required|string',
    port: 'required|integer',
    user: 'required|string',
    password: 'required|string',
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
    port: 'required|integer',
    user: 'required|string',
    password: 'required|string',
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

module.exports = {
  MySQLClient,

  getClient,
  createPool,
  createClient,
  createPromiseClient
};
