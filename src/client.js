'use strict';

const mysql = require('mysql2');
const { validate } = require('./utils');

const clients = {};

/**
 * initialize client
 * @param {mysql.ConnectionOptions} options
 * @returns {mysql.Connection}
 */
const createClient = (options, name = null) => {
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
  clients[key] = mysql.createConnection(options);
  clients[key].connect();
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
  createClient
};
