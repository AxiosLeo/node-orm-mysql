#!/usr/bin/env node

'use strict';

const path = require('path');
const { App } = require('@axiosleo/cli-tool');

const app = new App({
  name: 'MySQL ORM CLI',
  desc: 'migrate, model, seed, etc.',
  bin: 'orm-mysql',
  version: '0.10.3',
  commands_dir: path.join(__dirname, '../commands'),
});

app.start();
