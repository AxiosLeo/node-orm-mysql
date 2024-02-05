'use strict';

const { Builder } = require('./builder');
const is = require('@axiosleo/cli-tool/src/helper/is');

/**
 * 
 * @param {import('mysql2/promise').Connection} conn 
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

const _execSQL = (conn, sql, values = []) => {
  let opt = { sql, values };
  return new Promise((resolve, reject) => {
    if (conn.query instanceof Function) {
      conn.query(opt, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    } else {
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
