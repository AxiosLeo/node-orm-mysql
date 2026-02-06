'use strict';

const { Command, debug } = require('@axiosleo/cli-tool');
const { migrate } = require('../index');

class MigrateCommand extends Command {
  constructor() {
    super({
      name: 'migrate',
      desc: 'Migrate database',
    });
    this.addArgument('action', 'up or down', 'required');
    this.addArgument('dir', 'migration directory', 'optional', process.cwd());

    this.addOption('debug', 'd', '[false] debug mode', 'optional', false);
    this.addOption('host', null, '[localhost] mysql host', 'optional', 'localhost');
    this.addOption('port', null, '[3306] port number to connect to the database', 'optional', 3306);
    this.addOption('user', null, '[root] username for connect to the database', 'optional', 'root');
    this.addOption('pass', null, 'password to connect to the database', 'optional', '');
    this.addOption('db', null, 'database name', 'optional', '');
  }

  /**
   * @param {*} args 
   * @param {*} options 
   */
  async exec(args, options) {
    try {
      await migrate(args.action, args.dir, options);
      process.exit(0);
    } catch (e) {
      debug.error(e);
      process.exit(1);
    }
  }
}

module.exports = MigrateCommand;
