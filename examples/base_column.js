'use strict';

/**
 * @returns {Record<string, import('@axiosleo/orm-mysql').ColumnItem>}
 */
module.exports = {
  id: {
    type: 'int',
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  },
  created_at: {
    type: 'TIMESTAMP',
    allowNull: false,
    default: 'CURRENT_TIMESTAMP'
  },
  updated_at: {
    type: 'TIMESTAMP',
    allowNull: false,
    default: 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  },
  disabled_at: {
    type: 'TIMESTAMP',
    allowNull: true
  }
};
