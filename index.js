'use strict';

const {
  QueryHandler,
  QueryOperator,
  Query
} = require('./src/operator');

const { createClient, getClient } = require('./src/client');

module.exports = {
  Query,
  QueryHandler,
  QueryOperator,

  getClient,
  createClient
};
