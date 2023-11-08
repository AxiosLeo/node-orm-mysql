'use strict';

const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { validate } = require('./utils');

const clients = {};

/**
 * initialize client
 * @param {mysql.ConnectionOptions} options
 * @param name
 * @returns {mysql.Connection}
 */
const createClient = (options, name = null) => {
  validate(options, {
    host: 'required|string',
    user: 'required|string',
    password: 'required|string',
    port: 'required|integer',
    database: 'required|string',
    auto_connection: 'boolean',
  });
  const key = name ? name :
    `${options.host}:${options.port}:${options.user}:${options.password}:${options.database}`;
  if (clients[key]) {
    return clients[key];
  }
  if (options.auto_connection === true){
    delete options.auto_connection;
    clients[key] = mysql.createPool(options);
  }else {
    delete options.auto_connection;
    clients[key] = mysql.createConnection(options);
    clients[key].connect();
  }
  return clients[key];
};

/**
 * @param {mysql.ConnectionOptions} options
 * @param {string|null} name
 * @returns {mysqlPromise.Connection}
 */
const createPromiseClient = async (options, name = null) => {
  validate(options, {
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
  validate(options, {
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

module.exports = {
  getClient,
  createPool,
  createClient,
  createPromiseClient
};
