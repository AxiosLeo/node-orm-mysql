'use strict';

const Query = require('./query');
const is = require('@axiosleo/cli-tool/src/helper/is');

/**
 * @param {array} arr 
 * @param {string} res 
 */
const emit = (arr, res) => {
  if (res) {
    arr.push(res);
  }
};

class Builder {
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
        emit(tmp, `SELECT ${options.attrs ? options.attrs.map((a) => this._buildFieldKey(a)).join(',') : '*'} FROM ${this._buildTables(options.tables)}`);
        emit(tmp, this._buildJoins(options.joins));
        emit(tmp, this._buildContidion(options.conditions));
        emit(tmp, this._buildOrders(options.orders));
        emit(tmp, this._buldPagenation(options.pageLimit, options.pageOffset));
        if (options.having && options.having.length && !options.groupField.length) {
          throw new Error('having is not allowed without "GROUP BY"');
        }
        emit(tmp, this._buildGroupField(options.groupField));
        emit(tmp, this._buildHaving(options.having));
        sql = tmp.join(' ');
        break;
      }
      case 'insert': {
        const fields = this._buildValues(options.data);
        emit(tmp, `INSERT INTO ${this._buildTables(options.tables)}(${fields.map((f) => `\`${f}\``).join(',')})`);
        emit(tmp, `VALUES (${fields.map((f) => '?').join(',')})`);
        sql = tmp.join(' ');
        break;
      }
      case 'update': {
        const fields = this._buildValues(options.data);
        emit(tmp, `UPDATE ${this._buildTables(options.tables)}`);
        emit(tmp, `SET ${fields.map((f) => `\`${f}\` = ?`).join(',')}`);
        if (!options.conditions.length) {
          throw new Error('At least one condition is required for update operation');
        }
        emit(tmp, this._buildContidion(options.conditions));
        sql = tmp.join(' ');
        break;
      }
      case 'delete': {
        emit(tmp, `DELETE FROM ${this._buildTables(options.tables)}`);
        if (!options.conditions.length) {
          throw new Error('At least one where condition is required for delete operation');
        }
        emit(tmp, this._buildContidion(options.conditions));
        sql = tmp.join(' ');
        break;
      }
      case 'count': {
        emit(tmp, `SELECT COUNT(*) AS count FROM ${this._buildTables(options.tables)}`);
        emit(tmp, this._buildJoins(options.joins));
        emit(tmp, this._buildContidion(options.conditions));
        if (options.having && options.having.length && !options.groupField.length) {
          throw new Error('having is not allowed without "GROUP BY"');
        }
        emit(tmp, this._buildGroupField(options.groupField));
        emit(tmp, this._buildHaving(options.having));
        sql = tmp.join(' ');
        break;
      }
      default:
        throw new Error('Invalid operator: ' + options.operator);
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
    return this._buildContidion(having, 'HAVING ');
  }

  _buildJoins(joins = []) {
    return joins.map((j) => {
      let { table, alias, self_column, foreign_column, join_type } = j;
      if (alias) {
        table = `\`${table}\` AS \`${alias}\``;
      } else {
        table = `\`${table}\``;
      }
      let sql = '';
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
      sql += `${table} ON ${this._buildFieldWithTableName(self_column)} = ${this._buildFieldWithTableName(foreign_column)}`;
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
      if (t.alias) {
        return `\`${t.tableName}\` AS \`${t.alias}\``;
      }
      return `\`${t.tableName}\``;
    }).join(' , ');
  }

  _buldPagenation(limit, offset) {
    let sql = '';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }
    return sql;
  }

  _buildValues(obj) {
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

  _buildConditionValues(val) {
    if (val instanceof Query) {
      const builder = new Builder(val.options);
      this.values = this.values.concat(builder.values);
      return builder.sql;
    }
    this.values.push(val);
    return null;
  }

  _buildContidion(conditions, prefix) {
    if (!conditions || !conditions.length) {
      return '';
    }
    let sql = typeof prefix === 'undefined' ? 'WHERE ' : prefix;
    if (conditions.length) {
      sql += `${conditions.map((c) => {
        if (c.key === null && c.value === null) {
          return ` ${c.opt} `;
        }
        if (c.value === null) {
          return c.opt === '=' ? `ISNULL(${this._buildFieldKey(c.key)})` : `!ISNULL(${this._buildFieldKey(c.key)})`;
        }
        if (c.key && c.key.indexOf('->') !== -1) {
          const keys = c.key.split('->');
          return this._buildContidion([
            {
              key: `JSON_EXTRACT(${this._buildFieldKey(keys[0])}, '${keys[1]}')`,
              opt: c.opt,
              value: c.value
            }
          ], '');
        }
        const opt = c.opt.toLowerCase();
        if (opt === 'in' && Array.isArray(c.value)) {
          let res = this._buildConditionValues(c.value);
          return res ? `${this._buildFieldKey(c.key)} IN (${res})` : `${this._buildFieldKey(c.key)} IN (?)`;
        } else if (opt === 'group' && Array.isArray(c.value)) {
          return `(${this._buildContidion(c.value, '')})`;
        }
        let res = this._buildConditionValues(c.value);
        return res ? `${this._buildFieldKey(c.key)} ${c.opt} (${res})` : `${this._buildFieldKey(c.key)} ${c.opt} ?`;
      }).join('')}`;
    }
    return sql;
  }

  _buildFieldKey(key) {
    if (key === null) {
      return '';
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

module.exports = {
  Builder
};
