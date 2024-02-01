'use strict';

const Validator = require('validatorjs');

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

module.exports = {
  _validate,
};
