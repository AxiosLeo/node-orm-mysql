'use strict';

const is = require('@axiosleo/cli-tool/src/helper/is');

const _buildFieldKey = (key) => {
  if (!key) {
    return '';
  }
  return key.split('.').map((k) => `\`${k}\``).join('.');
};

const _buildContidion = (conditions, prefix) => {
  const values = [];
  let sql = typeof prefix === 'undefined' ? ' WHERE ' : '';
  if (conditions.length) {
    sql += `${conditions.map((c) => {
      if (c.key === null && c.value === null) {
        return ` ${c.opt} `;
      }
      if (c.value === null) {
        return c.opt === '=' ? `ISNULL(${_buildFieldKey(c.key)})` : `!ISNULL(${_buildFieldKey(c.key)})`;
      }
      const opt = c.opt.toLowerCase();
      if (opt === 'in' && Array.isArray(c.value)) {
        values.push(c.value.join(','));
        return `${_buildFieldKey(c.key)} IN (?)`;
      } else if (opt === 'group' && Array.isArray(c.value)) {
        const res = _buildContidion(c.value, '');
        values.push(...res.values);
        return `(${res.sql})`;
      }
      values.push(c.value);
      return `${_buildFieldKey(c.key)} ${c.opt} ?`;
    }).join('')}`;
  }
  return {
    sql,
    values
  };
};

const _buildValues = (obj) => {
  const fields = [];
  const values = [];
  Object.keys(obj).forEach((key) => {
    fields.push(`${key}`);
    if (obj[key] === null) {
      values.push('NULL');
      return;
    }
    if (Array.isArray(obj[key]) || is.object(obj[key])) {
      values.push(JSON.stringify(obj[key]));
    } else {
      values.push(obj[key]);
    }
  });
  return { fields, values };
};

const _buldPagenation = (limit, offset) => {
  let sql = '';
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  if (offset) {
    sql += ` OFFSET ${offset}`;
  }
  return sql;
};

const _buildTables = (tables) => {
  return tables.map((t) => {
    if (t.alias) {
      return `\`${t.tableName}\` AS \`${t.alias}\``;
    }
    return `\`${t.tableName}\``;
  }).join(' , ');
};

const _buildOrders = (orders = []) => {
  const sql = ' ORDER BY ' + orders.map((o) => {
    return `\`${o.sortField}\` ${o.sortOrder}`;
  }).join(',');
  return sql;
};

const _buildJoins = (joins = []) => {
  return joins.map((j) => {
    switch (j.type) {
      case 'left':
        return ` LEFT JOIN \`${j.table}\` AS \`${j.alias}\` ON ${j.on}`;
      case 'inner':
        return ` INNER JOIN \`${j.table}\` AS \`${j.alias}\` ON ${j.on}`;
      case 'right':
        return ` RIGHT JOIN \`${j.table}\` AS \`${j.alias}\` ON ${j.on}`;
    }
  }).join(' ');
};

const buildSql = (options) => {
  let sql = options.sql;
  let values = options.values;
  switch (options.operator) {
    case 'find': {
      options.pageLimit = 1;
      options.pageOffset = 0;
    }
    // eslint-disable-next-line no-fallthrough
    case 'select': {
      sql = `SELECT ${options.attrs ? options.attrs.map((a) => _buildFieldKey(a)).join(',') : '*'} FROM ${_buildTables(options.tables)}`;
      sql += _buildJoins(options.joins);
      const res = _buildContidion(options.conditions);
      sql += res.sql;
      values = options.values.concat(res.values);
      sql += options.orders.length > 0 ? _buildOrders(options.orders) : '';
      sql += _buldPagenation(options.pageLimit, options.pageOffset);
      if (options.groupField.length) {
        sql += ` GROUP BY ${options.groupField.join(',')}`;
      }
      break;
    }
    case 'insert': {
      const buildValueRes = _buildValues(options.data);
      sql = `INSERT INTO ${_buildTables(options.tables)}(${buildValueRes.fields.map((f) => _buildFieldKey(f))}) VALUES (${buildValueRes.fields.map(() => '?').join(',')})`;
      values = values.concat(buildValueRes.values);
      break;
    }
    case 'update': {
      const buildValueRes = _buildValues(options.data);
      sql = `UPDATE ${_buildTables(options.tables)} SET ${buildValueRes.fields.map(f => `${_buildFieldKey(f)} = ?`).join(',')}`;
      values = values.concat(values);
      const buildConditionRes = _buildContidion(options.conditions);
      sql += buildConditionRes.sql;
      values = values.concat(buildConditionRes.values);
      break;
    }
    case 'delete': {
      sql = `DELETE FROM ${_buildTables(options.tables)}`;
      if (!options.conditions.length) {
        throw new Error('At least one where condition is required for delete operation');
      }
      const buildConditionRes = _buildContidion(options.conditions);
      sql += buildConditionRes.sql;
      values = values.concat(buildConditionRes.values);
      break;
    }
    case 'count': {
      sql = `SELECT COUNT(*) AS count FROM ${_buildTables(options.tables)}`;
      const buildConditionRes = _buildContidion(options.conditions);
      sql += buildConditionRes.sql;
      values = values.concat(buildConditionRes.values);
      if (options.groupField.length) {
        sql += ` GROUP BY ${options.groupField.join(',')}`;
      }
      break;
    }
    default:
      throw new Error('Invalid operator: ' + options.operator);
  }

  return {
    sql,
    values: values
  };
};

module.exports = {
  buildSql
};
