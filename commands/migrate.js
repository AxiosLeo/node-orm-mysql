'use strict';

const { Command, debug, Workflow } = require('@axiosleo/cli-tool');
const is = require('@axiosleo/cli-tool/src/helper/is');
const migration = require('../src/migration');

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
    const workflow = new Workflow(migration);
    try {
      await workflow.start({
        task_key: 'migrate_logs',
        action: args.action,
        config: {
          dir: args.dir
        },
        connection: {
          host: options.host,
          port: is.number(options.port) ?
            options.port : parseInt(options.port),
          user: options.user,
          password: options.pass,
          database: options.db
        },
        debug: options.debug
      });
      process.exit(0);
    } catch (e) {
      if (e.curr && e.curr.error) {
        debug.error(e.curr.error);
      } else {
        debug.log(e);
      }
      process.exit(1);
    }
  }
}

module.exports = MigrateCommand;
