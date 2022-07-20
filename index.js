'use strict';

const {
  QueryHandler,
  QueryOperator
} = require('./src/query');

const { createClient, getClient } = require('./src/client');

module.exports = {
  QueryHandler,
  QueryOperator,

  getClient,
  createClient
};
