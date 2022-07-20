'use strict';

module.exports = {
  all: false,
  include: [
    'src/'
  ],
  exclude: [
    'src/app.js',
    'src/debug.js',
    'src/helper/cmd.js',
  ],
  'watermarks': {
    'lines': [80, 95],
    'functions': [80, 95],
    'branches': [80, 95],
    'statements': [80, 95]
  }
};
