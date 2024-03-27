'use strict';

const { debug } = require('@axiosleo/cli-tool');
const { Query } = require('./query');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { _caml_case, _render } = require('@axiosleo/cli-tool/src/helper/str');
const { _validate } = require('./utils');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');

/**
 * @param {array} arr 
 * @param {string} res 
 */
const emit = (arr, res) => {
  if (res) {
    arr.push(res);
  }
};

const operations = ['find', 'select', 'insert', 'update', 'delete', 'count', 'manage'];

class Builder {
  /**
   * @param {import('../index').QueryOperatorOptions} options 
   */
  constructor(options) {
    let sql = '';
    this.values = [];
    let tmp = [];
    switch (options.operator) {
      case 'find': {
        options.pageLimit = 1;
        options.pageOffset = 0;
      }
      // eslint-disable-next-line no-fallthrough
      case 'select': {
        options.attrs = options.attrs || [];
        const attrs = options.attrs.map((attr) => {
          if (attr instanceof Function) {
            attr = attr();
          }
          if (attr instanceof Query) {
            const builder = new Builder(attr.options);
            this.values = this.values.concat(builder.values);
            let s = `(${builder.sql})`;
            if (attr.alias) {
              return attr.alias.indexOf(' ') > -1 ? s + ' ' + this._buildFieldKey(attr.alias)
                : s + ' AS ' + this._buildFieldKey(attr.alias);
            }
            return s;
          }
          return attr;
        });
        emit(tmp, `SELECT ${attrs.length ? attrs.map((a) => this._buildFieldKey(a)).join(',') : '*'} FROM ${this._buildTables(options.tables)}`);
        emit(tmp, this._buildJoins(options.joins));
        emit(tmp, this._buildCondition(options.conditions));
        emit(tmp, this._buildOrders(options.orders));
        emit(tmp, this._buildPagination(options.pageLimit, options.pageOffset));
        if (options.having && options.having.length && !options.groupField.length) {
          throw new Error('having is not allowed without "GROUP BY"');
        }
        emit(tmp, this._buildGroupField(options.groupField));
        emit(tmp, this._buildHaving(options.having));
        sql = tmp.join(' ');
        if (options.suffix) {
          sql += ' ' + options.suffix;
        }
        break;
      }
      case 'insert': {
        const { fields, sqlStr } = this._buildValues(options.data);
        emit(tmp, `INSERT INTO ${this._buildTables(options.tables)}(${fields.map((f) => `\`${f}\``).join(',')})`);
        emit(tmp, `VALUES ${sqlStr}`);
        if (options.keys) {
          let columns = fields.filter(f => !options.keys.includes(f));
          emit(tmp, `ON DUPLICATE KEY UPDATE ${columns.map((f) => `\`${f}\` = VALUES(\`${f}\`)`).join(',')}`);
        }
        sql = tmp.join(' ');
        break;
      }
      case 'update': {
        if (is.invalid(options.data)) {
          throw new Error('Data is required for update operation');
        }
        const fields = this._buildValue(options.data);
        emit(tmp, `UPDATE ${this._buildTables(options.tables)}`);
        emit(tmp, `SET ${fields.map((f) => `\`${f}\` = ?`).join(',')}`);
        if (!options.conditions.length) {
          throw new Error('At least one condition is required for update operation');
        }
        emit(tmp, this._buildCondition(options.conditions));
        sql = tmp.join(' ');
        break;
      }
      case 'delete': {
        emit(tmp, `DELETE FROM ${this._buildTables(options.tables)}`);
        if (!options.conditions.length) {
          throw new Error('At least one where condition is required for delete operation');
        }
        emit(tmp, this._buildCondition(options.conditions));
        sql = tmp.join(' ');
        break;
      }
      case 'count': {
        emit(tmp, `SELECT COUNT(*) AS count FROM ${this._buildTables(options.tables)}`);
        emit(tmp, this._buildJoins(options.joins));
        emit(tmp, this._buildCondition(options.conditions));
        if (options.having && options.having.length && !options.groupField.length) {
          throw new Error('"HAVING" is not allowed without "GROUP BY"');
        }
        emit(tmp, this._buildGroupField(options.groupField));
        emit(tmp, this._buildHaving(options.having));
        sql = tmp.join(' ');
        break;
      }
      case 'manage': {
        break;
      }
      default:
        throw new Error('Invalid operator: ' + options.operator);
    }

    if (options.explain) {
      sql = 'EXPLAIN ' + sql;
    }

    this.sql = sql;
  }

  _buildGroupField(groupFields = []) {
    if (!groupFields || !groupFields.length) {
      return '';
    }
    return `GROUP BY ${groupFields.map(f => this._buildFieldKey(f)).join(',')}`;
  }

  _buildHaving(having) {
    if (!having || !having.length) {
      return '';
    }
    return this._buildCondition(having, 'HAVING ');
  }

  _buildJoins(joins = []) {
    return joins.map((j) => {
      let { table, alias, self_column, foreign_column, join_type } = j;
      if (table instanceof Query || table.options) {
        if (!alias) {
          throw new Error('Alias is required for subQuery');
        }
        const builder = new Builder(table.options);
        this.values = this.values.concat(builder.values);
        table = `(${builder.sql})`;
        if (alias) {
          table = `${table} AS \`${alias}\``;
        }
      } else if (alias) {
        table = `\`${table}\` AS \`${alias}\``;
      } else {
        table = `\`${table}\``;
      }
      let sql = '';
      join_type = join_type.toLowerCase();
      switch (join_type) {
        case 'left':
          sql = 'LEFT JOIN ';
          break;
        case 'right':
          sql = 'RIGHT JOIN ';
          break;
        default:
          sql = 'INNER JOIN ';
          break;
      }
      if (j.on) {
        sql += `${table} ON ${j.on}`;
      } else {
        sql += `${table} ON ${this._buildFieldWithTableName(self_column)} = ${this._buildFieldWithTableName(foreign_column)}`;
      }
      return sql;
    }).join(' ');
  }

  _buildOrders(orders = []) {
    if (!orders || !orders.length) {
      return '';
    }
    const sql = 'ORDER BY ' + orders.map((o) => {
      return `${this._buildFieldKey(o.sortField)} ${o.sortOrder}`;
    }).join(',');
    return sql;
  }

  _buildTables(tables) {
    if (!tables || !tables.length) {
      throw new Error('At least one table is required');
    }
    return tables.map((t) => {
      let name = t.table.split('.').map((n) => {
        if (n[0] === '`' && n[n.length - 1] === '`') {
          return n;
        }
        return `\`${n}\``;
      }).join('.');
      if (t.alias) {
        return `${name} AS \`${t.alias}\``;
      }
      return name;
    }).join(' , ');
  }

  _buildPagination(limit, offset) {
    let sql = '';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }
    return sql;
  }

  _buildValue(obj) {
    const fields = [];
    Object.keys(obj).forEach((key) => {
      fields.push(`${key}`);
      if (obj[key] instanceof Date) {
        this.values.push(obj[key]);
      } else if (Array.isArray(obj[key]) || is.object(obj[key])) {
        this.values.push(JSON.stringify(obj[key]));
      } else {
        this.values.push(obj[key]);
      }
    });
    return fields;
  }

  _buildValues(value) {
    let fields = [];
    if (is.array(value)) {
      [fields] = value.map((v) => this._buildValue(v));
      let item = '(' + fields.map(f => '?').join(',') + ')';
      return { fields, sqlStr: new Array(value.length).fill(item).join(',') };
    }
    fields = this._buildValue(value);

    return { fields, sqlStr: '(' + fields.map(f => '?').join(',') + ')' };
  }

  _buildConditionValues(val) {
    if (is.string(val)) {
      if (val.startsWith('`') && val.endsWith('`')) {
        return val;
      }
    }
    if (val instanceof Query) {
      const builder = new Builder(val.options);
      this.values = this.values.concat(builder.values);
      return builder.sql;
    }
    this.values.push(val);
    return null;
  }

  _buildConditionIn(condition, isNot = false) {
    if (Array.isArray(condition.value) && !condition.value.length) {
      throw new Error('Value must not be empty for "IN" condition');
    } else if (!Array.isArray(condition.value) && !(condition.value instanceof Query)) {
      throw new Error('Value must be an array or sub-query for "IN" condition');
    }
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      let res = this._buildConditionValues(condition.value);
      let sql = res ? `JSON_CONTAINS(JSON_ARRAY(${res}), JSON_EXTRACT(${k}, '${keys[1]}'))` :
        `JSON_CONTAINS(JSON_ARRAY(?), JSON_EXTRACT(${k}, '${keys[1]}'))`;
      return isNot ? `${sql}=0` : sql;
    }
    let v = is.string(condition.value) ? condition.value.split(',').map(v => v.trim()) : condition.value;
    let res = this._buildConditionValues(v);
    const opt = isNot ? 'NOT IN' : 'IN';
    return res ? `${this._buildFieldKey(condition.key)} ${opt} (${res})` : `${this._buildFieldKey(condition.key)} ${opt} (?)`;
  }

  _buildConditionContain(condition, isNot = false) {
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      let res = this._buildConditionValues(condition.value);
      let sql = res ? `JSON_CONTAINS(${k}, JSON_ARRAY(${res}), '${keys[1]}')` :
        `JSON_CONTAINS(${k}, JSON_ARRAY(?), '${keys[1]}')`;
      return isNot ? `${sql}=0` : sql;
    }
    let res = this._buildConditionValues(condition.value);
    const opt = isNot ? 'NOT LIKE' : 'LIKE';
    return res ? `${this._buildFieldKey(condition.key)} ${opt} CONCAT('%', ?, '%')` : `${this._buildFieldKey(condition.key)} ${opt} CONCAT('%', ?, '%')`;
  }

  _buildConditionOverlaps(condition, isNot = false) {
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      let res = this._buildConditionValues(condition.value);
      let sql = res ? `JSON_OVERLAPS(JSON_EXTRACT(${k}, '${keys[1]}'), JSON_ARRAY(${res}))` :
        `JSON_OVERLAPS(JSON_EXTRACT(${k}, '${keys[1]}'), JSON_ARRAY(?))`;
      return isNot ? `${sql}=0` : sql;
    }
    let res = this._buildConditionValues(condition.value);
    const opt = isNot ? 'NOT REGEXP' : 'REGEXP';
    return res ? `${this._buildFieldKey(condition.key)} ${opt} ?` : `${this._buildFieldKey(condition.key)} ${opt} ?`;
  }

  _buildCondition(conditions, prefix) {
    if (!conditions || !conditions.length) {
      return '';
    }
    let sql = typeof prefix === 'undefined' ? 'WHERE ' : prefix;
    if (conditions.length) {
      sql += `${conditions.map((c, index) => {
        const opt = c.opt.toLowerCase();
        if (opt === 'group' && Array.isArray(c.value)) {
          let t = `(${this._buildCondition(c.value, '')})`;
          return index === 0 ? t : ` AND ${t}`;
        }
        if (opt === 'in') {
          return this._buildConditionIn(c);
        } else if (opt === 'not in') {
          return this._buildConditionIn(c, true);
        } else if (opt === 'contain') {
          return this._buildConditionContain(c);
        } else if (opt === 'not contain') {
          return this._buildConditionContain(c, true);
        } else if (opt === 'overlaps') {
          return this._buildConditionOverlaps(c);
        } else if (opt === 'not overlaps') {
          return this._buildConditionOverlaps(c, true);
        }
        if (c.key && c.key.indexOf('->') !== -1) {
          const keys = c.key.split('->');
          return this._buildCondition([
            {
              key: `JSON_EXTRACT(${this._buildFieldKey(keys[0])}, '${keys[1]}')`,
              opt: c.opt,
              value: c.value
            }
          ], '');
        }
        if (typeof c.key === 'undefined') {
          c.key = null;
        }
        if (typeof c.value === 'undefined') {
          c.value = null;
        }
        if (c.key === null && c.value === null) {
          return ` ${c.opt} `;
        }
        if (c.value === null) {
          return c.opt === '=' ? `ISNULL(${this._buildFieldKey(c.key)})` : `!ISNULL(${this._buildFieldKey(c.key)})`;
        }
        let res = this._buildConditionValues(c.value);
        if (!is.empty(res)) {
          if (res.startsWith('`') && res.endsWith('`')) {
            return `${this._buildFieldKey(c.key)} ${c.opt} ${res}`;
          }
          return `${this._buildFieldKey(c.key)} ${c.opt} (${res})`;
        }
        return `${this._buildFieldKey(c.key)} ${c.opt} ?`;
      }).join('')}`;
    }
    return sql;
  }

  _buildFieldKey(key) {
    if (key === null) {
      return '';
    }
    if (typeof key === 'undefined') {
      throw new Error('Field key is required');
    }
    if (key.indexOf('(') !== -1 && key.indexOf(')') !== -1) {
      let field = key.substring(key.indexOf('(') + 1, key.indexOf(')'));
      key = key.substring(0, key.indexOf('(')) + '(' + this._buildFieldWithTableName(field) + ')' + key.substring(key.indexOf(')') + 1);
    }
    if (key.indexOf(' as ') !== -1) {
      const field = key.substring(key.indexOf(' as ') + 4);
      key = key.substring(0, key.indexOf(' as ')) + ' AS ' + this._buildFieldWithTableName(field);
    } else if (key.indexOf(' AS ') !== -1) {
      const field = key.substring(key.indexOf(' AS ') + 4);
      key = key.substring(0, key.indexOf(' AS ')) + ' AS ' + this._buildFieldWithTableName(field);
    }
    return this._buildFieldWithTableName(key);
  }

  _buildFieldWithTableName(key) {
    if (key.indexOf('$') !== -1 || key.indexOf('*') !== -1) {
      return key;
    }
    return key.split('.').map((k) => k.indexOf('`') !== -1 ? k : `\`${k}\``).join('.');
  }
}

class ManageSQLBuilder extends Builder {
  /**
   * @param {import('./migration').ManageBuilderOptions} options 
   */
  constructor(options) {
    if (operations.indexOf(options.operator) > -1) {
      super(options);
    } else {
      super({ operator: 'manage' });
      const action = `${options.operator}_${options.target}`;
      const method = _caml_case(action, false);
      if (!this[method]) {
        throw new Error(`'${options.target}' Unsupported '${options.operator}' operation.`);
      }
      try {
        this.sql = this[method].call(this, options);
      } catch (err) {
        debug.dump(`${options.operator} ${options.target} error: ${err.message}`);
        throw err;
      }
    }
  }

  /**
   * @param {import('../index').ManageBuilderOptions} options 
   */
  createTable(options) {
    _validate(options, {
      name: 'required|string',
      engine: [{ in: ['InnoDB', 'MyISAM', 'MEMORY'] }],
      charset: 'string'
    });
    if (is.empty(options.columns)) {
      throw new Error('At least one column is required');
    }
    let columns = Object.keys(options.columns).map(name => {
      return { name, ...options.columns[name] };
    });
    options = _assign({
      engine: 'InnoDB',
      charset: 'utf8mb4'
    }, options, {
      columns: this.createColumns(columns, options.name)
    });
    return _render('CREATE TABLE `${name}` ( ${columns} ) ENGINE=${engine} DEFAULT CHARSET=${charset}', options);
  }

  createColumn(options) {
    if (!options.table) {
      throw new Error('Table name is required');
    }
    return `ALTER TABLE \`${options.table}\` ADD COLUMN ` + this.renderSingleColumn(options);
  }

  createIndex(options) {
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
      columns: 'required|array',
      unique: 'boolean',
      fulltext: 'boolean',
      spatial: 'boolean',
      order: [{ in: ['asc', 'desc'] }],
      visible: 'boolean'
    });

    return _render('CREATE INDEX `${index_name}` ON `${table_name}` (${column_names}) ${visible}', {
      index_name: options.name,
      table_name: options.table,
      visible: options.visible === false ? 'INVISIBLE' : 'VISIBLE',
      column_names: options.columns.map(c => {
        if (c.indexOf(' ') !== -1) {
          let t = c.split(' ', 2);
          return `\`${t[0]}\` ${t[1].toUpperCase()}`;
        }
        return `\`${c}\``;
      }).join(', ')
    });
  }

  createForeignKey(options) {
    options.reference.onDelete = options.reference.onDelete ? options.reference.onDelete.toUpperCase() : 'NO ACTION';
    options.reference.onUpdate = options.reference.onUpdate ? options.reference.onUpdate.toUpperCase() : 'NO ACTION';
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
      column: 'required|string',
      'reference.tableName': 'required|string',
      'reference.columnName': 'required|string',
      'reference.onUpdate': [{ in: ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'] }],
      'reference.onDelete': [{ in: ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'] }]
    });
    return _render('ALTER TABLE `${table_name}` ADD CONSTRAINT `${name}` FOREIGN KEY (`${column_name}`) REFERENCES `${foreign_table}` (`${foreign_column}`) ON DELETE ${on_delete} ON UPDATE ${on_update}', {
      table_name: options.tableName,
      name: options.name,
      column_name: options.columnName,
      foreign_table: options.reference.tableName,
      foreign_column: options.reference.columnName,
      on_delete: options.reference.onDelete || 'NO ACTION',
      on_update: options.reference.onUpdate || 'NO ACTION',
    });
  }

  dropTable(options) {
    _validate(options, {
      name: 'required|string',
    });
    return _render('DROP TABLE `${name}`', options);
  }

  dropColumn(options) {
    _validate(options, {
      table: 'required|string',
      name: 'required|string',
    });
    return _render('ALTER TABLE `${table}` DROP COLUMN `${name}`', options);

  }

  dropIndex(options) {
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
    });
    return _render('DROP INDEX `${name}` ON `${table}`', options);
  }

  dropForeignKey(options) {
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
    });
    return _render('ALTER TABLE `${table}` DROP FOREIGN KEY `${name}`', options);
  }

  createColumns(columns, table) {
    let primaryColumn = null;
    let indexColumns = [];
    let referenceColumns = [];
    let strs = columns.map(column => {
      let str = this.renderSingleColumn(column);
      if (column.primaryKey === true) {
        primaryColumn = column;
      } else if (column.uniqIndex === true) {
        indexColumns.push(column);
      }
      if (column.reference) {
        column.reference.onDelete = column.reference.onDelete ? column.reference.onDelete.toUpperCase() : 'NO ACTION';
        column.reference.onUpdate = column.reference.onUpdate ? column.reference.onUpdate.toUpperCase() : 'NO ACTION';

        _validate(column.reference, {
          table: 'required|string',
          column: 'required|string',
          onDelete: [{ in: ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'] }],
          onUpdate: [{ in: ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'] }]
        });
        referenceColumns.push({
          name: 'fk_' + table + '_' + column.name,
          table,
          column: column.name,
          reference: {
            tableName: column.reference.table,
            columnName: column.reference.column,
            onDelete: column.reference.onDelete,
            onUpdate: column.reference.onUpdate
          }
        });
      }
      return str;
    });
    if (primaryColumn) {
      strs.push(`PRIMARY KEY (\`${primaryColumn.name}\`)`);
      strs.push(`UNIQUE INDEX \`${primaryColumn.name}\` (\`${primaryColumn.name}\` ASC) VISIBLE`);
    }
    if (indexColumns.length > 0) {
      indexColumns.forEach((i) => {
        strs.push(`UNIQUE INDEX \`${i.name}\` (\`${i.name}\` ASC) VISIBLE`);
      });
    }
    if (referenceColumns.length) {
      referenceColumns.forEach((r) => {
        strs.push(this.createForeignKey(r));
      });
    }
    return strs.join(', ');
  }

  renderSingleColumn(options) {
    _validate(options, {
      name: 'required|string',
      type: 'required|string',
      onUpdate: 'string',
      length: 'integer',
      comment: 'string',
      allowNull: 'boolean',
      autoIncrement: 'boolean',
      collate: 'string',
      primaryKey: 'boolean',
      uniqIndex: 'boolean'
    });
    let type = options.type.toUpperCase();
    if (type === 'STRING') {
      type = 'VARCHAR';
    }
    let str = `\`${options.name}\` ${type}`;
    if (typeof options.length !== 'undefined') {
      str += `(${options.length})`;
    } else if (type === 'INT') {
      str += '(11)';
    } else if (type === 'VARCHAR') {
      str += '(255)';
    } else if (type === 'TINYINT') {
      str += '(4)';
    }
    if (options.allowNull === false) {
      str += ' NOT NULL';
    }
    if (options.unsigned === true) {
      str += ' UNSIGNED';
    }
    if (typeof options.default !== 'undefined') {
      if (options.primaryKey === true) {
        throw new Error('Primary key can not have default value.');
      }
      if (options.default === null) {
        str += ' DEFAULT NULL';
      } else if (options.default === 'timestamp' || options.default === 'TIMESTAMP') {
        str += ' DEFAULT CURRENT_TIMESTAMP';
      } else if (options.default === 'CURRENT_TIMESTAMP') {
        str += ` DEFAULT ${options.default}`;
      } else if (is.string(options.default)) {
        str += ` DEFAULT '${options.default}'`;
      } else {
        str += ` DEFAULT ${options.default}`;
      }
    }
    if (options.onUpdate) {
      str += ` ON UPDATE ${options.onUpdate}`;
    }
    if (is.string(options.comment) && is.empty(options.comment) === false) {
      str += ` COMMENT '${options.comment}'`;
    }
    if (options.autoIncrement === true) {
      str += ' AUTO_INCREMENT';
    }
    if (options.after) {
      str += ' AFTER `' + options.after + '`';
    }
    return str;
  }
}

module.exports = {
  Builder,
  ManageSQLBuilder
};
