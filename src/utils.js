'use strict';

const Validator = require('validatorjs');
const { Builder } = require('./builder');

const _validate = (obj, rules, throwError = true) => {
  let validation = new Validator(obj, rules);
  validation.check();
  if (validation.fails()) {
    const errors = validation.errors.all();
    const keys = Object.keys(errors);
    if (throwError) {
      throw new Error(`${keys[0]}: ${errors[keys[0]]}`);
    }
    return errors;
  }
  return null;
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

/**
 * 
 * @param {import('mysql2/promise').Connection} conn 
 * @param {*} options 
 * @param {*} opt 
 * @returns 
 */
const _query = (conn, options, opt = null) => {
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
      if (typeof options.query_handler === 'function') {
        const promise = options.query_handler(conn, options, opt);
        if (promise instanceof Promise) {
          return promise;
        }
      }
      throw new Error('query_handler must return a promise');
    }
  }
};

module.exports = {
  _query,
  _execSQL,
  _validate,
};
