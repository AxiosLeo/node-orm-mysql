'use strict';

const path = require('path');

const dotenv = require('dotenv');
dotenv.config({
  path: path.join(__dirname, '../../../.env')
});

module.exports = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB
};
