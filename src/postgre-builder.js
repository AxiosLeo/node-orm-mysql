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

const operations = ['find', 'select', 'insert', 'update', 'incrBy', 'delete', 'count', 'manage'];

/**
 * PostgreSQL Query Builder
 * Key differences from MySQL:
 * - Uses double quotes " for identifiers instead of backticks
 * - Uses $1, $2, $3... placeholders instead of ?
 * - Uses IS NULL instead of ISNULL()
 * - Uses ON CONFLICT ... DO UPDATE instead of ON DUPLICATE KEY UPDATE
 * - Uses PostgreSQL JSON functions (jsonb_extract_path_text, etc.)
 */
class PostgreBuilder {
  /**
   * @param {import('../index').QueryOperatorOptions} options 
   */
  constructor(options) {
    this.values = [];
    this.paramIndex = 0; // Track parameter index for $1, $2, etc.
    if (operations.includes(options.operator) === false) {
      throw new Error(`Unsupported '${options.operator}' operation.`);
    }
    if (options.operator !== 'manage') {
      const action = `_${options.operator}Operator`;
      let sql = this[action].call(this, options);
      if (options.explain) {
        sql = 'EXPLAIN ' + sql;
      }
      this.sql = sql;
    }
  }

  /**
   * Get next parameter placeholder ($1, $2, etc.)
   */
  _nextParam() {
    this.paramIndex++;
    return `$${this.paramIndex}`;
  }

  _findOperator(options) {
    options.pageLimit = 1;
    options.pageOffset = 0;
    return this._selectOperator(options);
  }

  _selectOperator(options) {
    let tmp = [];
    let sql = '';
    options.attrs = options.attrs || [];
    const attrs = options.attrs.map((attr) => {
      if (attr instanceof Function) {
        attr = attr();
      }
      if (attr instanceof Query) {
        const builder = new PostgreBuilder(attr.options);
        // Adjust parameter indices
        const offset = this.paramIndex;
        builder.sql = builder.sql.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + offset}`);
        this.paramIndex += builder.paramIndex;
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
    if (options.having && options.having.length && !options.groupField.length) {
      throw new Error('having is not allowed without "GROUP BY"');
    }
    emit(tmp, `SELECT ${attrs.length ? attrs.map((a) => this._buildFieldKey(a)).join(',') : '*'} FROM ${this._buildTables(options.tables)}`);
    // PostgreSQL doesn't support FORCE INDEX, skip it
    emit(tmp, this._buildJoins(options.joins));
    emit(tmp, this._buildCondition(options.conditions));
    emit(tmp, this._buildGroupField(options.groupField));
    emit(tmp, this._buildHaving(options.having));
    emit(tmp, this._buildOrders(options.orders));
    emit(tmp, this._buildPagination(options.pageLimit, options.pageOffset));
    sql = tmp.join(' ');
    if (options.suffix) {
      sql += ' ' + options.suffix;
    }
    return sql;
  }

  _insertOperator(options) {
    let tmp = [];
    const { fields, sqlStr } = this._buildValues(options.data);
    emit(tmp, `INSERT INTO ${this._buildTables(options.tables)}(${fields.map((f) => `"${f}"`).join(',')})`);
    emit(tmp, `VALUES ${sqlStr}`);
    // PostgreSQL uses ON CONFLICT ... DO UPDATE for upsert
    if (options.keys) {
      let columns = fields.filter(f => !options.keys.includes(f));
      const conflictColumns = options.keys.map(k => `"${k}"`).join(',');
      const updateSet = columns.map((f) => `"${f}" = EXCLUDED."${f}"`).join(',');
      if (updateSet) {
        emit(tmp, `ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updateSet}`);
      }
    }
    return tmp.join(' ');
  }

  _updateOperator(options) {
    let tmp = [];
    if (is.invalid(options.data)) {
      throw new Error('Data is required for update operation');
    }
    const fields = this._buildValue(options.data);
    emit(tmp, `UPDATE ${this._buildTables(options.tables)}`);
    // PostgreSQL doesn't support FORCE INDEX
    emit(tmp, `SET ${fields.map((f) => `"${f}" = ${this._nextParam()}`).join(',')}`);
    if (!options.conditions.length) {
      throw new Error('At least one condition is required for update operation');
    }
    emit(tmp, this._buildCondition(options.conditions));
    return tmp.join(' ');
  }

  _incrByOperator(options) {
    let tmp = [];
    emit(tmp, `UPDATE ${this._buildTables(options.tables)}`);
    const key = this._buildFieldKey(options.attrs[0]);
    const param = this._nextParam();
    emit(tmp, `SET ${key} = ${key} + ${param}`);
    if (is.string(options.increment)) {
      this.values.push(parseInt(options.increment, 10));
    } else if (is.func(options.increment)) {
      this.values.push(options.increment());
    } else if (is.number(options.increment)) {
      this.values.push(options.increment);
    } else {
      throw new Error('Invalid increment value');
    }
    if (!options.conditions.length) {
      throw new Error('At least one condition is required for update operation');
    }
    emit(tmp, this._buildCondition(options.conditions));
    return tmp.join(' ');
  }

  _deleteOperator(options) {
    let tmp = [];
    emit(tmp, `DELETE FROM ${this._buildTables(options.tables)}`);
    if (!options.conditions.length) {
      throw new Error('At least one where condition is required for delete operation');
    }
    emit(tmp, this._buildCondition(options.conditions));
    return tmp.join(' ');
  }

  _countOperator(options) {
    let tmp = [];
    emit(tmp, `SELECT COUNT(*) AS count FROM ${this._buildTables(options.tables)}`);
    emit(tmp, this._buildJoins(options.joins));
    emit(tmp, this._buildCondition(options.conditions));
    if (options.having && options.having.length && !options.groupField.length) {
      throw new Error('"HAVING" is not allowed without "GROUP BY"');
    }
    emit(tmp, this._buildGroupField(options.groupField));
    emit(tmp, this._buildHaving(options.having));
    return tmp.join(' ');
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
        const builder = new PostgreBuilder(table.options);
        // Adjust parameter indices
        const offset = this.paramIndex;
        builder.sql = builder.sql.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + offset}`);
        this.paramIndex += builder.paramIndex;
        this.values = this.values.concat(builder.values);
        table = `(${builder.sql})`;
        if (alias) {
          table = `${table} AS "${alias}"`;
        }
      } else if (alias) {
        table = `"${table}" AS "${alias}"`;
      } else {
        table = `"${table}"`;
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
        if (n[0] === '"' && n[n.length - 1] === '"') {
          return n;
        }
        return `"${n}"`;
      }).join('.');
      if (t.alias) {
        return `${name} AS "${t.alias}"`;
      }
      return name;
    }).join(' , ');
  }

  _buildPagination(limit, offset) {
    let sql = '';
    if (!is.invalid(limit)) {
      if (!is.integer(limit) || limit < 0) {
        throw new Error('Invalid limit value');
      }
      limit = parseInt(limit, 10);
      sql += ` LIMIT ${limit}`;
    }

    if (!is.invalid(offset)) {
      if (!is.integer(offset) || offset < 0) {
        throw new Error('Invalid offset value');
      }
      offset = parseInt(offset, 10);
      if (offset > 0) {
        sql += ` OFFSET ${offset}`;
      }
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
      fields = this._buildValue(value[0]);

      this.values = this.values.slice(0, -fields.length);

      value.forEach((obj) => {
        fields.forEach((field) => {
          const val = obj[field];
          if (val instanceof Date) {
            this.values.push(val);
          } else if (Array.isArray(val) || is.object(val)) {
            this.values.push(JSON.stringify(val));
          } else {
            this.values.push(val);
          }
        });
      });

      // Build multiple value sets with $1, $2, etc.
      const rows = [];
      for (let i = 0; i < value.length; i++) {
        const params = fields.map(() => this._nextParam());
        rows.push('(' + params.join(',') + ')');
      }
      return { fields, sqlStr: rows.join(',') };
    }
    fields = this._buildValue(value);

    const params = fields.map(() => this._nextParam());
    return { fields, sqlStr: '(' + params.join(',') + ')' };
  }

  _buildConditionValues(val) {
    if (is.string(val)) {
      // PostgreSQL uses double quotes for identifiers
      if (val.startsWith('"') && val.endsWith('"')) {
        return val;
      }
      // Also support backticks for compatibility
      if (val.startsWith('`') && val.endsWith('`')) {
        return '"' + val.slice(1, -1) + '"';
      }
    }
    if (val instanceof Query) {
      const builder = new PostgreBuilder(val.options);
      // Adjust parameter indices
      const offset = this.paramIndex;
      builder.sql = builder.sql.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + offset}`);
      this.paramIndex += builder.paramIndex;
      this.values = this.values.concat(builder.values);
      return builder.sql;
    }
    this.values.push(val);
    return null;
  }

  _buildConditionBetween(condition, isNot = false) {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) {
      throw new Error('Value must be an array with two elements for "BETWEEN" condition');
    }
    const param1 = this._nextParam();
    const param2 = this._nextParam();
    this.values.push(condition.value[0] || null);
    this.values.push(condition.value[1] || null);
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      // PostgreSQL JSON path extraction
      let sql = `(${k}->>'${keys[1].replace(/^\$\./, '')}')::text `;
      sql += isNot ? 'NOT BETWEEN' : 'BETWEEN';
      sql += ` ${param1} AND ${param2}`;
      return sql;
    }
    const opt = isNot ? 'NOT BETWEEN' : 'BETWEEN';
    return `${this._buildFieldKey(condition.key)} ${opt} ${param1} AND ${param2}`;
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
      // PostgreSQL JSON array contains
      let jsonPath = keys[1].replace(/^\$\./, '');
      let sql = res ? `(${k}->>'${jsonPath}') = ANY(ARRAY[${res}])` :
        `(${k}->>'${jsonPath}') = ANY(ARRAY[${this._nextParam()}])`;
      return isNot ? `NOT ${sql}` : sql;
    }
    let v = is.string(condition.value) ? condition.value.split(',').map(v => v.trim()) : condition.value;
    let res = this._buildConditionValues(v);
    const opt = isNot ? 'NOT IN' : 'IN';
    if (res) {
      return `${this._buildFieldKey(condition.key)} ${opt} (${res})`;
    }
    // For array values, use ANY
    return `${this._buildFieldKey(condition.key)} ${opt} (${this._nextParam()})`;
  }

  _buildConditionContain(condition, isNot = false) {
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      let jsonPath = keys[1].replace(/^\$\./, '');
      const param = this._nextParam();
      this.values.push(condition.value);
      // PostgreSQL JSONB contains check
      let sql = `${k} @> jsonb_build_object('${jsonPath}', ${param})`;
      return isNot ? `NOT ${sql}` : sql;
    }
    const param = this._nextParam();
    this.values.push(condition.value);
    const opt = isNot ? 'NOT LIKE' : 'LIKE';
    return `${this._buildFieldKey(condition.key)} ${opt} '%' || ${param} || '%'`;
  }

  _buildConditionOverlaps(condition, isNot = false) {
    if (condition.key.indexOf('->') !== -1) {
      let keys = condition.key.split('->');
      let k = `${this._buildFieldKey(keys[0])}`;
      let jsonPath = keys[1].replace(/^\$\./, '');
      const param = this._nextParam();
      this.values.push(JSON.stringify(condition.value));
      // PostgreSQL JSONB overlap check
      let sql = `(${k}->'${jsonPath}') ?| ARRAY(SELECT jsonb_array_elements_text(${param}::jsonb))`;
      return isNot ? `NOT ${sql}` : sql;
    }
    const param = this._nextParam();
    this.values.push(condition.value);
    // PostgreSQL regex
    const opt = isNot ? '!~' : '~';
    return `${this._buildFieldKey(condition.key)} ${opt} ${param}`;
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
          if (index === 0 || conditions[index - 1].opt === 'group') {
            return t;
          }
          const lastOpt = conditions[index - 1].opt;
          if (['AND', 'OR'].indexOf(lastOpt) > -1) {
            return t;
          }
          return ` AND ${t}`;
        }
        if (opt === 'in') {
          return this._buildConditionIn(c);
        } else if (opt === 'not in') {
          return this._buildConditionIn(c, true);
        } else if (opt === 'between') {
          return this._buildConditionBetween(c);
        } else if (opt === 'not between') {
          return this._buildConditionBetween(c, true);
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
          let jsonPath = keys[1].replace(/^\$\./, '');
          return this._buildCondition([
            {
              key: `(${this._buildFieldKey(keys[0])}->>'${jsonPath}')`,
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
          // PostgreSQL uses IS NULL instead of ISNULL()
          return c.opt === '=' ? `${this._buildFieldKey(c.key)} IS NULL` : `${this._buildFieldKey(c.key)} IS NOT NULL`;
        }
        let res = this._buildConditionValues(c.value);
        if (!is.empty(res)) {
          if (res.startsWith('"') && res.endsWith('"')) {
            return `${this._buildFieldKey(c.key)} ${c.opt} ${res}`;
          }
          return `${this._buildFieldKey(c.key)} ${c.opt} (${res})`;
        }
        return `${this._buildFieldKey(c.key)} ${c.opt} ${this._nextParam()}`;
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
    // PostgreSQL uses double quotes for identifiers
    return key.split('.').map((k) => k.indexOf('"') !== -1 ? k : `"${k}"`).join('.');
  }
}

/**
 * PostgreSQL Migration SQL Builder
 */
class PostgreManageSQLBuilder extends PostgreBuilder {
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
   * @param {import('./migration').ManageBuilderOptions} options 
   */
  createTable(options) {
    _validate(options, {
      name: 'required|string',
    });
    if (is.empty(options.columns)) {
      throw new Error('At least one column is required');
    }
    let columns = Object.keys(options.columns).map(name => {
      return { name, ...options.columns[name] };
    });
    options = _assign({}, options, {
      columns: this.createColumns(columns, options.name)
    });
    return _render('CREATE TABLE "${name}" ( ${columns} )', options);
  }

  createColumn(options) {
    if (!options.table) {
      throw new Error('Table name is required');
    }
    return `ALTER TABLE "${options.table}" ADD COLUMN ` + this.renderSingleColumn(options);
  }

  createIndex(options) {
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
      columns: 'required|array',
      unique: 'boolean',
    });

    let str = options.unique === true ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';

    return _render(str + ' "${index_name}" ON "${table_name}" (${column_names})', {
      index_name: options.name,
      table_name: options.table,
      column_names: options.columns.map(c => {
        if (c.indexOf(' ') !== -1) {
          let t = c.split(' ', 2);
          return `"${t[0]}" ${t[1].toUpperCase()}`;
        }
        return `"${c}"`;
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
    return _render('ALTER TABLE "${table_name}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column_name}") REFERENCES "${foreign_table}" ("${foreign_column}") ON DELETE ${on_delete} ON UPDATE ${on_update}', {
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
    return _render('DROP TABLE "${name}"', options);
  }

  dropColumn(options) {
    _validate(options, {
      table: 'required|string',
      name: 'required|string',
    });
    return _render('ALTER TABLE "${table}" DROP COLUMN "${name}"', options);
  }

  dropIndex(options) {
    _validate(options, {
      name: 'required|string',
    });
    // PostgreSQL doesn't need table name to drop index
    return _render('DROP INDEX "${name}"', options);
  }

  dropForeignKey(options) {
    _validate(options, {
      name: 'required|string',
      table: 'required|string',
    });
    return _render('ALTER TABLE "${table}" DROP CONSTRAINT "${name}"', options);
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
      strs.push(`PRIMARY KEY ("${primaryColumn.name}")`);
    }
    if (indexColumns.length > 0) {
      indexColumns.forEach((i) => {
        strs.push(`UNIQUE ("${i.name}")`);
      });
    }
    // Foreign keys are added as constraints
    if (referenceColumns.length) {
      referenceColumns.forEach((r) => {
        strs.push(`CONSTRAINT "${r.name}" FOREIGN KEY ("${r.column}") REFERENCES "${r.reference.tableName}" ("${r.reference.columnName}") ON DELETE ${r.reference.onDelete} ON UPDATE ${r.reference.onUpdate}`);
      });
    }
    return strs.join(', ');
  }

  /**
   * Map MySQL types to PostgreSQL types
   */
  _mapType(type) {
    const typeMap = {
      'TINYINT': 'SMALLINT',
      'MEDIUMINT': 'INTEGER',
      'INT': 'INTEGER',
      'BIGINT': 'BIGINT',
      'FLOAT': 'REAL',
      'DOUBLE': 'DOUBLE PRECISION',
      'DECIMAL': 'NUMERIC',
      'DATETIME': 'TIMESTAMP',
      'TINYTEXT': 'TEXT',
      'MEDIUMTEXT': 'TEXT',
      'LONGTEXT': 'TEXT',
      'TINYBLOB': 'BYTEA',
      'BLOB': 'BYTEA',
      'MEDIUMBLOB': 'BYTEA',
      'LONGBLOB': 'BYTEA',
      'VARCHAR': 'VARCHAR',
      'CHAR': 'CHAR',
      'TEXT': 'TEXT',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'TIMESTAMP': 'TIMESTAMP',
      'YEAR': 'INTEGER',
      'JSON': 'JSONB',
      'ENUM': 'TEXT', // PostgreSQL uses CHECK constraints or custom types
      'SET': 'TEXT[]',
    };
    return typeMap[type] || type;
  }

  renderSingleColumn(options) {
    _validate(options, {
      name: 'required|string',
      type: 'required|string',
      onUpdate: 'string',
      length: 'integer',
      precision: 'integer',
      comment: 'string',
      allowNull: 'boolean',
      autoIncrement: 'boolean',
      primaryKey: 'boolean',
      uniqIndex: 'boolean'
    });
    let type = options.type.toUpperCase();
    if (type === 'STRING') {
      type = 'VARCHAR';
    }
    
    // Map to PostgreSQL type
    type = this._mapType(type);
    
    // Handle auto increment - use SERIAL types
    if (options.autoIncrement === true) {
      if (type === 'BIGINT') {
        type = 'BIGSERIAL';
      } else if (type === 'SMALLINT') {
        type = 'SMALLSERIAL';
      } else {
        type = 'SERIAL';
      }
    }
    
    let str = `"${options.name}" ${type}`;
    
    // Add length for types that need it (skip for SERIAL types)
    if (typeof options.length !== 'undefined' && !type.includes('SERIAL')) {
      if (type === 'NUMERIC') {
        str = `"${options.name}" ${type}(${options.precision || 10}, ${options.length || 6})`;
      } else if (type === 'VARCHAR' || type === 'CHAR') {
        str = `"${options.name}" ${type}(${options.length})`;
      }
    } else if (type === 'VARCHAR' && !type.includes('SERIAL')) {
      str = `"${options.name}" ${type}(255)`;
    }
    
    if (options.allowNull === false || options.primaryKey === true) {
      // SERIAL types are already NOT NULL
      if (!type.includes('SERIAL')) {
        str += ' NOT NULL';
      }
    }
    
    // PostgreSQL doesn't have UNSIGNED, skip it
    
    if (typeof options.default !== 'undefined' && !options.autoIncrement) {
      if (options.primaryKey === true) {
        throw new Error('Primary key can not have default value.');
      }
      if (options.default === null) {
        str += ' DEFAULT NULL';
      } else if (options.default === 'timestamp' || options.default === 'TIMESTAMP' || options.default === 'CURRENT_TIMESTAMP') {
        str += ' DEFAULT CURRENT_TIMESTAMP';
      } else if (is.string(options.default)) {
        str += ` DEFAULT '${options.default}'`;
      } else {
        str += ` DEFAULT ${options.default}`;
      }
    }
    
    // PostgreSQL doesn't support ON UPDATE in column definition
    // Would need a trigger for this functionality
    
    return str;
  }
}

module.exports = {
  PostgreBuilder,
  PostgreManageSQLBuilder
};
