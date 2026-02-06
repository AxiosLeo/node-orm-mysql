'use strict';

const { Workflow } = require('@axiosleo/cli-tool');
const is = require('@axiosleo/cli-tool/src/helper/is');
const Hook = require('./src/hook');
const { Builder } = require('./src/builder');
const migration = require('./src/migration');

const {
  QueryHandler,
  QueryOperator,
  QueryCondition,
  Query
} = require('./src/operator');

const {
  TransactionOperator,
  TransactionHandler
} = require('./src/transaction');

const {
  getClient,
  createPool,
  createClient,
  createPromiseClient,

  MySQLClient
} = require('./src/client');

const _runMigration = async (action, dir, options = {}) => {
  const workflow = new Workflow(migration);
  try {
    await workflow.start({
      task_key: 'migrate_logs',
      action: action.toLowerCase(),
      config: {
        dir: dir
      },
      connection: {
        host: options.host,
        port: is.number(options.port) ?
          options.port : parseInt(options.port),
        user: options.user,
        password: options.password,
        database: options.database
      },
      debug: options.debug
    });
  } catch (e) {
    if (e.curr && e.curr.error) {
      throw e.curr.error;
    } else {
      throw e;
    }
  }
};

module.exports = {
  Hook,
  Builder,

  Query,
  QueryHandler,
  QueryOperator,
  QueryCondition,

  TransactionOperator,
  TransactionHandler,

  MySQLClient,
  getClient,
  createPool,
  createClient,
  createPromiseClient,
  migrate: _runMigration
};
