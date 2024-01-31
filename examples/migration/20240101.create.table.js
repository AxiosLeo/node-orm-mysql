'use strict';

/**
 * @param {import('../../').MigrationInterface} migration
 */
function up(migration) {
  migration.createTable({
    table_name: 'table1',
    columns: [{
      column_name: 'id',
      type: 'int(11)',
      not_null: true,
      is_primary_key: true,
    }]
  });
}

/**
 * @param {import('../../').MigrationInterface} migration
 */
function down(migration) {
  migration.dropTable({ table_name: 'table1' });
}

module.exports = {
  up,
  down
};
