'use strict';

const Validator = require('validatorjs');

const validate = (obj, rules) => {
  let validation = new Validator(obj, rules);
  validation.check();
  if (validation.fails()) {
    const errors = validation.errors.all();
    const keys = Object.keys(errors);
    throw new Error(`${keys[0]}: ${errors[keys[0]]}`);
  }
};

module.exports = {
  validate
};
