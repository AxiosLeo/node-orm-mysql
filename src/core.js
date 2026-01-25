'use strict';

const { Builder } = require('./builder');
const { PostgreBuilder } = require('./postgre-builder');
const is = require('@axiosleo/cli-tool/src/helper/is');

/**
 * 
 * @param {import('mysql2/promise').Connection | import('pg').Client | import('pg').Pool} conn 
 * @param {*} options 
 * @param {*} opt 
 * @returns 
 */
const _query = (conn, options, opt = null) => {
  if (is.empty(options)) {
    options = { driver: 'mysql' };
  }
  switch (options.driver) {
    case 'mysql': {
      if (opt === null) {
        const builder = new Builder(options);
        opt = {
          sql: builder.sql,
          values: builder.values || [],
        };
      }
      return new Promise((resolve, reject) => {
        if (options.transaction) {
          conn.execute(opt.sql, opt.values || []).then((res) => {
            resolve(res[0]);
          }).catch((err) => reject(err));
          return;
        }
        conn.query(opt, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });

      });
    }
    case 'postgre': {
      if (opt === null) {
        const builder = new PostgreBuilder(options);
        opt = {
          text: builder.sql,
          values: builder.values || [],
        };
      }
      // PostgreSQL pg library uses promise-based API
      return conn.query(opt.text || opt.sql, opt.values || []).then((res) => {
        return res.rows;
      });
    }
    default: {
      if (typeof options.queryHandler === 'function') {
        const promise = options.queryHandler(conn, options, opt);
        if (promise instanceof Promise) {
          return promise;
        }
      }
      throw new Error('queryHandler must return a promise');
    }
  }
};

const _execSQL = (conn, sql, values = [], driver = 'mysql') => {
  if (driver === 'postgre') {
    // PostgreSQL pg library - promise-based
    return conn.query(sql, values).then((res) => res.rows);
  }
  // MySQL
  let opt = { sql, values };
  return new Promise((resolve, reject) => {
    if (conn.query instanceof Function && conn.query.length >= 2) {
      // Callback-based MySQL connection
      conn.query(opt, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else {
      // Promise-based MySQL connection
      conn.execute(opt)
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    }
  });
};

module.exports = {
  _query,
  _execSQL
};
