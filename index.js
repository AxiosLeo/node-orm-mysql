'use strict';

const {
  QueryHandler,
  QueryOperator,
  Query
} = require('./src/operator');

const { createClient, getClient } = require('./src/client');

const { Hook } = require('./src/hook');

module.exports = {
  Hook,

  Query,
  QueryHandler,
  QueryOperator,

  getClient,
  createClient
};
