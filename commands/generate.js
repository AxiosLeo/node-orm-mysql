'use strict';

const path = require('path');
const { Command, printer } = require('@axiosleo/cli-tool');
const { _exists, _write } = require('@axiosleo/cli-tool/src/helper/fs');
const { _snake_case } = require('@axiosleo/cli-tool/src/helper/str');

class GenerateCommand extends Command {
  constructor() {
    super({
      name: 'generate',
      desc: '',
      alias: ['gen']
    });
    this.addArgument('name', 'Migration name', 'required', '');
    this.addArgument('dir', 'Migration scripts directory', 'optional', process.cwd());
  }

  /**
   * @param {*} args 
   * @param {*} options 
   * @param {string[]} argList 
   * @param {import('@axiosleo/cli-tool').App} app 
   */
  async exec(args, options) {
    const { name, dir } = args;
    const fileName = parseInt((new Date()).valueOf() / 1000) + '.' + _snake_case(name) + '.js';
    const filePath = path.join(dir, fileName);
    if (await _exists(filePath)) {
      printer.error('Migration script file already exists: ' + fileName);
      return;
    }
    const template = `
'use strict';

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function up(migration) {
}

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function down(migration) {
}

module.exports = {
  up,
  down
};
`;
    await _write(filePath, template);
    printer.info('Migration file created: ' + filePath);
  }
}

module.exports = GenerateCommand;
