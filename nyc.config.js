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
    'lines': [0, 40],
    'functions': [0, 40],
    'branches': [0, 40],
    'statements': [0, 40]
  }
};
