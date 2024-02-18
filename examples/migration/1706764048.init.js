'use strict';

const baseColumn = require('../base_column');

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function up(migration) {
  migration.createTable('orgs', {
    ...baseColumn,
    code: {
      type: 'varchar',
      length: 64,
      allowNull: false,
      uniqIndex: true
    },
    name: {
      type: 'VARCHAR',
      allowNull: false
    },
    type: {
      type: 'VARCHAR',
      comment: '集团 group;公司 company;',
      allowNull: false
    },
  });

  migration.createTable('account', {
    ...baseColumn,
    uuid: {
      type: 'VARCHAR',
      length: 36,
      allowNull: false,
      uniqIndex: true,
      comment: 'uuid'
    },
    username: {
      type: 'varchar',
      length: 64,
      allowNull: false,
    },
    name: {
      type: 'VARCHAR',
      length: 100,
      allowNull: false,
      comment: '姓名',
    },
    avatar: {
      type: 'VARCHAR',
      allowNull: true,
      comment: '头像文件索引'
    },
    password: {
      type: 'varchar',
      length: 64,
      allowNull: false
    },
    last_token: {
      type: 'VARCHAR',
      length: 36,
      allowNull: true,
      comment: '最后一次登录的token'
    }
  });
  migration.createIndex('account', ['username asc']);

  migration.createTable('account_orgs', {
    id: baseColumn.id,
    account_id: {
      type: 'int',
      allowNull: false,
      references: {
        table: 'account',
        column: 'id'
      }
    },
    org_id: {
      type: 'int',
      allowNull: false,
      references: {
        table: 'orgs',
        column: 'id'
      }
    },
    type: {
      type: 'varchar',
      length: 32,
      allowNull: false,
      comment: '组织创建者creator;组织管理员admin;组织用户user;',
      default: 'user'
    }
  });
  migration.createColumn('created_at', 'TIMESTAMP', 'account_orgs');
}

/**
 * @param {import('@axiosleo/orm-mysql').MigrationInterface} migration
 */
function down(migration) {
  migration.dropTable('account_orgs');
  migration.dropTable('account');
  migration.dropTable('orgs');
}

module.exports = {
  up,
  down
};
