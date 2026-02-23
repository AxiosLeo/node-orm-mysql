'use strict';

let expect = null;
const { _initMigration } = require('../src/migration');

describe('migration test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  });

  describe('addColumn method', () => {
    it('should add column to queries with basic options', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'email', {
        type: 'varchar',
        length: 255
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`email` VARCHAR(255)');
      expect(queries[file][0].values).to.be.an('array');
    });

    it('should add column with all options', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'age', {
        type: 'int',
        length: 11,
        unsigned: true,
        allowNull: false,
        default: 0,
        comment: 'User age',
        autoIncrement: false,
        primaryKey: false,
        uniqIndex: false
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`age` INT(11)');
      expect(queries[file][0].sql).to.include('UNSIGNED');
      expect(queries[file][0].sql).to.include('NOT NULL');
      expect(queries[file][0].sql).to.include('DEFAULT 0');
      expect(queries[file][0].sql).to.include('COMMENT \'User age\'');
    });

    it('should add column with nullable and default null', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'bio', {
        type: 'text',
        allowNull: true,
        default: null
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`bio` TEXT');
      expect(queries[file][0].sql).to.include('DEFAULT NULL');
    });

    it('should add column with timestamp default', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'created_at', {
        type: 'datetime',
        default: 'timestamp'
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`created_at` DATETIME');
      expect(queries[file][0].sql).to.include('DEFAULT CURRENT_TIMESTAMP');
    });

    it('should add column with auto increment', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'id', {
        type: 'int',
        autoIncrement: true,
        primaryKey: true
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`id` INT(11)');
      expect(queries[file][0].sql).to.include('NOT NULL');
      expect(queries[file][0].sql).to.include('AUTO_INCREMENT');
    });

    it('should add column with after clause', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'middle_name', {
        type: 'varchar',
        length: 100,
        after: 'first_name'
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][0].sql).to.include('`middle_name` VARCHAR(100)');
      expect(queries[file][0].sql).to.include('AFTER `first_name`');
    });

    it('should add multiple columns to same file', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.addColumn('users', 'email', { type: 'varchar', length: 255 });
      migrationObj.addColumn('users', 'phone', { type: 'varchar', length: 20 });

      expect(queries[file].length).to.be.equal(2);
      expect(queries[file][0].sql).to.include('`email`');
      expect(queries[file][1].sql).to.include('`phone`');
    });
  });

  describe('raw method', () => {
    it('should add raw SQL to queries', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.raw('SELECT * FROM users WHERE id = ?', [1]);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('SELECT * FROM users WHERE id = ?');
      expect(queries[file][0].values).to.deep.equal([1]);
    });

    it('should add raw SQL with multiple values', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.raw('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com']);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(queries[file][0].values).to.deep.equal(['John', 'john@example.com']);
    });

    it('should add raw SQL with empty values array', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.raw('CREATE INDEX idx_test ON users (name)', []);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('CREATE INDEX idx_test ON users (name)');
      expect(queries[file][0].values).to.deep.equal([]);
    });

    it('should add multiple raw SQL statements', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.raw('UPDATE users SET status = ? WHERE id = ?', ['active', 1]);
      migrationObj.raw('DELETE FROM logs WHERE created_at < ?', [new Date('2020-01-01')]);

      expect(queries[file].length).to.be.equal(2);
      expect(queries[file][0].sql).to.be.equal('UPDATE users SET status = ? WHERE id = ?');
      expect(queries[file][0].values).to.deep.equal(['active', 1]);
      expect(queries[file][1].sql).to.be.equal('DELETE FROM logs WHERE created_at < ?');
      expect(queries[file][1].values[0]).to.be.instanceOf(Date);
    });

    it('should add raw SQL with complex values', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      const values = [1, 'test', null, true, false, 123.45];
      migrationObj.raw('INSERT INTO test VALUES (?, ?, ?, ?, ?, ?)', values);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('INSERT INTO test VALUES (?, ?, ?, ?, ?, ?)');
      expect(queries[file][0].values).to.deep.equal(values);
    });

    it('should add raw SQL with JSON values', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      const jsonData = { key: 'value', nested: { data: 123 } };
      migrationObj.raw('UPDATE users SET metadata = ? WHERE id = ?', [JSON.stringify(jsonData), 1]);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('UPDATE users SET metadata = ? WHERE id = ?');
      expect(queries[file][0].values[0]).to.be.a('string');
      expect(queries[file][0].values[1]).to.be.equal(1);
    });

    it('should add raw SQL mixed with other migration methods', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.raw('SET FOREIGN_KEY_CHECKS = 0', []);
      migrationObj.addColumn('users', 'email', { type: 'varchar', length: 255 });
      migrationObj.raw('SET FOREIGN_KEY_CHECKS = 1', []);

      expect(queries[file].length).to.be.equal(3);
      expect(queries[file][0].sql).to.be.equal('SET FOREIGN_KEY_CHECKS = 0');
      expect(queries[file][1].sql).to.include('ALTER TABLE `users` ADD COLUMN');
      expect(queries[file][2].sql).to.be.equal('SET FOREIGN_KEY_CHECKS = 1');
    });
  });

  describe('createForeignKey method', () => {
    it('should create foreign key with auto-generated name', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.createForeignKey('orders', {
        columnName: 'user_id',
        reference: {
          tableName: 'users',
          columnName: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        }
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('orders');
      expect(queries[file][0].sql).to.include('FOREIGN KEY');
      expect(queries[file][0].sql).to.include('fk_orders_user_id');
    });

    it('should create foreign key with custom name', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.createForeignKey('orders', {
        foreignKey: 'fk_custom_key',
        columnName: 'user_id',
        reference: {
          tableName: 'users',
          columnName: 'id'
        }
      });

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.include('fk_custom_key');
    });
  });

  describe('dropTable method', () => {
    it('should drop table', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropTable('users');

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('DROP TABLE `users`');
    });
  });

  describe('dropColumn method', () => {
    it('should drop column with table as first param', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropColumn('users', 'email');

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('ALTER TABLE `users` DROP COLUMN `email`');
    });

    it('should drop multiple columns separately', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropColumn('users', 'email');
      migrationObj.dropColumn('users', 'phone');

      expect(queries[file].length).to.be.equal(2);
      expect(queries[file][0].sql).to.include('DROP COLUMN `email`');
      expect(queries[file][1].sql).to.include('DROP COLUMN `phone`');
    });
  });

  describe('dropIndex method', () => {
    it('should drop index by columns with auto-generated name', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropIndex('users', ['email']);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('DROP INDEX `idx_users_email` ON `users`');
    });

    it('should drop index by multiple columns', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropIndex('users', ['first_name', 'last_name']);

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('DROP INDEX `idx_users_first_name_last_name` ON `users`');
    });
  });

  describe('dropIndexWithName method', () => {
    it('should drop index by explicit name', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropIndexWithName('users', 'idx_custom_name');

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('DROP INDEX `idx_custom_name` ON `users`');
    });
  });

  describe('dropForeignKey method', () => {
    it('should drop foreign key with table as first param', () => {
      const queries = {};
      const file = 'test_migration.js';
      queries[file] = [];
      const migrationObj = _initMigration(file, queries);

      migrationObj.dropForeignKey('orders', 'fk_orders_user_id');

      expect(queries[file].length).to.be.equal(1);
      expect(queries[file][0].sql).to.be.equal('ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_user_id`');
    });
  });
});

