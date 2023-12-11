'use strict';

const Validator = require('validatorjs');
const { Builder } = require('./builder');

const _validate = (obj, rules) => {
  let validation = new Validator(obj, rules);
  validation.check();
  if (validation.fails()) {
    const errors = validation.errors.all();
    const keys = Object.keys(errors);
    throw new Error(`${keys[0]}: ${errors[keys[0]]}`);
  }
};

const _query = async (conn, options, opt = null) => {
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
          conn.execute(opt)
            .then((res) => resolve(res))
            .catch((err) => reject(err));
        } else {
          conn.query(opt, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        }
      });
    }
    default: {
      const promise = options.query_handler(conn, options, opt);
      if (!(promise instanceof Promise)) {
        throw new Error('query_handler must return a promise');
      }
      return promise;
    }
  }
};

module.exports = {
  _validate,
  _query
};
