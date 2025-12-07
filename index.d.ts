import {
  Connection,
  ConnectionOptions,
  OkPacket,
  Pool,
  PoolOptions,
  QueryOptions,
  ResultSetHeader,
  RowDataPacket
} from 'mysql2';

import {
  Connection as PromiseConnection,
} from 'mysql2/promise';

type MySQLQueryResult = OkPacket | ResultSetHeader;

export type Clients = {
  [key: string]: Connection | Pool
}

export type ConditionValueType = null | string | number | boolean | Date | Array<string | number | boolean | Date> | Query;

export type OptType = '=' | '!=' | '>' | '<' | '>=' | '<=' |
  'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'NOT BETWEEN' | 'IS' | 'IS NOT' | 'REGEXP' | 'NOT REGEXP' | 'AND' | 'OR' | 'GROUP' | 'CONTAIN' | 'NOT CONTAIN' | 'OVERLAPS' | 'NOT OVERLAPS' |
  'like' | 'not like' | 'in' | 'not in' | 'between' | 'not between' | 'is' | 'is not' | 'regexp' | 'not regexp' | 'and' | 'or' | 'group' | 'contain' | 'not contain' | 'overlaps' | 'not overlaps';

export interface WhereOptions {
  key: string | null;
  opt: OptType;
  value?: ConditionValueType | WhereOptions[] | null;
}

export type WhereArrayOptions = [string | null, OptType, ConditionValueType | WhereOptions[] | null]
  | [string | null, ConditionValueType | WhereOptions[]];

export type WhereItem = WhereOptions | OptType | WhereArrayOptions;

export interface OrderByOptions {
  sortField: string,
  sortOrder: 'asc' | 'desc'
}

export type OperatorType = 'select' | 'find' | 'insert' | 'update' | 'delete' | 'count';
export type CascadeType = 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'restrict' | 'cascade' | 'set null' | 'no action';
export type JoinType = 'left' | 'right' | 'inner' | 'LEFT' | 'RIGHT' | 'INNER';

export interface JoinOption {
  table: string | Query;
  table_alias?: string;
  self_column?: string;
  foreign_column?: string;
  join_type?: JoinType;
  on?: string;
}

interface TableOption {
  table: string;
  alias: string | null;
}

export type QueryOperatorBaseOptions = {
  driver?: string | 'mysql';
  queryHandler?: QueryHandler;
};

export type AttrSubQuery = () => Query;
export type Attr = string | AttrSubQuery | Query;

export type QueryOperatorOptions = QueryOperatorBaseOptions & {
  conditions: WhereOptions[];
  attrs?: Attr[] | null;
  orders: OrderByOptions[];
  pageLimit?: number;
  pageOffset?: number;
  tables: TableOption[];
  forceIndex: string | null | string[];
  operator: OperatorType | null;
  data: any | null;
  groupField: string[];
  joins: JoinOption[];
  having: WhereOptions[];
  suffix?: string | null;
  transaction: boolean;
  explain?: boolean;
}

export declare class QueryCondition {
  where(logicOpt: 'OR' | 'or' | 'AND' | 'and'): this;

  where(key: string, value: ConditionValueType | WhereOptions[]): this;

  where(key: string, opt: OptType, value: ConditionValueType | WhereOptions[]): this;

  /**
 * @deprecated will deprecated on v1.0+ version
 */
  where(key: string | null, value: ConditionValueType | WhereOptions[], opt?: OptType): this;

  where(key: string, opt: OptType, value: ConditionValueType | WhereOptions[], isOr?: boolean): this;

  where(obj: Record<string, ConditionValueType>): this;

  whereAnd(): this;

  whereOr(): this;

  whereIn(key: string, value: string | string[] | number[] | Query): this;

  whereNotIn(key: string, value: string | string[] | number[] | Query): this;

  whereContain(key: string, value: string | number): this;

  whereNotContain(key: string, value: string | number): this;

  whereBetween(key: string, value: any[]): this;

  whereNotBetween(key: string, value: any[]): this;

  whereOverlaps(key: string, value: any[]): this;

  whereNotOverlaps(key: string, value: any[]): this;

  whereLike(key: string, value: string | string[]): this;

  whereNotLike(key: string, value: string | string[]): this;

  whereCondition(condition: QueryCondition): this;

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  whereObject(obj: Record<string, ConditionValueType>): this;
}

export type JoinOptions = {
  alias?: string,
  conditions: WhereItem[]
};

export declare class Query extends QueryCondition {

  options: QueryOperatorOptions;

  constructor(operator?: OperatorType, alias?: string | null);

  table(table: string, alias?: string | null): this;

  tables(...tables: TableOption[]): this;

  keys(...keys: string[]): this;

  limit(limit: number): this;

  offset(offset: number): this;

  attr(...attr: Attr[]): this;

  orderBy(sortField: string, sortOrder: 'asc' | 'desc'): this;

  groupBy(...groupField: string[]): this;

  having(key: string | null, opt: OptType, value: ConditionValueType | WhereOptions[]): this;

  page(limit: number, offset?: number): this;

  set(data: any): this;

  join(opt: JoinOption): this;

  leftJoin(table: string | Query, on: string, options?: { alias?: string }): this;

  rightJoin(table: string | Query, on: string, options?: { alias?: string }): this;

  innerJoin(table: string | Query, on: string, options?: { alias?: string }): this;

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  whereConditions(...condition: WhereItem[]): this;

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  groupWhere(...condition: WhereItem[]): this;

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  orWhere(key: string | null, opt: OptType, value: ConditionValueType | WhereOptions[]): this;

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  andWhere(key: string | null, opt: OptType, value: ConditionValueType | WhereOptions[]): this;
}

export type QueryResult = any | undefined | RowDataPacket[] | RowDataPacket | MySQLQueryResult;

export type ExplainResult = {
  select_type: 'PRIMARY' | 'DERIVED';
  table: string;
  partitions: string | null;
  type: string | 'ALL' | 'eq_ref';
  possible_keys: null | 'PRIMARY';
  key: null | string;
  key_len: null | number;
  ref: null | string;
  rows: number;
  filtered: number;
  Extra: null | string | 'Using filesort';

  id?: number;
  [property: string]: any;
};

export declare class QueryOperator extends Query {
  conn: Connection | Pool;

  options: QueryOperatorOptions

  constructor(conn: Connection | Pool, opt?: QueryOperatorBaseOptions);

  /**
   * @deprecated will deprecated on v1.0+ version
   */
  buildSql(operator: OperatorType): Builder;

  exec(): Promise<QueryResult>;

  explain(operator: OperatorType): Promise<ExplainResult[]>;

  select<T extends Object>(...attrs: string[]): Promise<T[]>;
  select<T extends Object>(...attrs: string[]): Promise<Builder>;

  find<T extends Object>(): Promise<T>;
  find<T extends Object>(): Promise<Builder>;

  count(): Promise<number>;
  count(): Promise<Builder>;

  /**
   * increment a column value
   * @param attr 
   * @param increment default is 1
   */
  incrBy(attr: string, increment?: string | number | ((number: number) => number)): Promise<MySQLQueryResult>;
  incrBy(attr: string, increment?: string | number | ((number: number) => number)): Promise<Builder>;

  delete(id?: number, index_field_name?: string): Promise<MySQLQueryResult>;
  delete(id?: number, index_field_name?: string): Promise<Builder>;

  update(row?: any): Promise<MySQLQueryResult>;
  update(row?: any): Promise<Builder>;

  update<T extends Object>(row?: T): Promise<MySQLQueryResult>;
  update<T extends Object>(row?: T): Promise<Builder>;

  insert(row?: any): Promise<MySQLQueryResult>;
  insert(row?: any): Promise<Builder>;

  insert<T extends Object>(row?: T): Promise<MySQLQueryResult>;
  insert<T extends Object>(row?: T): Promise<Builder>;

  insertAll(rows: any[]): Promise<MySQLQueryResult[]>;
  insertAll(rows: any[]): Promise<Builder>;

  insertAll<T extends Object>(rows: T[]): Promise<MySQLQueryResult[]>;
  insertAll<T extends Object>(rows: T[]): Promise<Builder>;

  upsertRow(row: any, condition: QueryCondition): Promise<MySQLQueryResult>;
  upsertRow(row: any, condition: QueryCondition): Promise<Builder>;

  upsertRow<T extends Object>(row: T, ...conditions: WhereItem[]): Promise<MySQLQueryResult>;
  upsertRow<T extends Object>(row: T, ...conditions: WhereItem[]): Promise<MySQLQueryResult | Builder>;

  notExec(): this;
}

export type TableInfoColumn = 'TABLE_CATALOG' | 'TABLE_SCHEMA' | 'TABLE_NAME' | 'COLUMN_NAME' | 'ORDINAL_POSITION' |
  'COLUMN_DEFAULT' | 'IS_NULLABLE' | 'DATA_TYPE' | 'CHARACTER_MAXIMUM_LENGTH' | 'CHARACTER_OCTET_LENGTH' |
  'NUMERIC_PRECISION' | 'NUMERIC_SCALE' | 'DATETIME_PRECISION' | 'CHARACTER_SET_NAME' | 'COLLATION_NAME' |
  'COLUMN_TYPE' | 'COLUMN_KEY' | 'EXTRA' | 'PRIVILEGES' | 'COLUMN_COMMENT' | 'GENERATION_EXPRESSION' | 'SRS_ID';

export declare class QueryHandler {
  conn: Connection | Pool;
  options: QueryOperatorBaseOptions;

  constructor(conn: Connection | Pool, options?: QueryOperatorBaseOptions);

  /**
   * select table
   * @param table 
   * @param alias 
   */
  table(table: string, alias?: string | null): QueryOperator;

  /**
   * select tables
   * @param tables 
   */
  tables(...tables: TableOption[]): QueryOperator;

  /**
   * execute sql
   * @param options 
   */
  query(options: QueryOptions): Promise<any>;

  /**
   * insert or update
   * @deprecated
   * @param tableName 
   * @param data 
   * @param condition 
   */
  upsert(tableName: string, data: any, condition: Record<string, ConditionValueType>): Promise<MySQLQueryResult>;

  /**
 * @param database default is options.database
 */
  existDatabase(database?: string): Promise<boolean>;

  /**
   * @param table
   * @param database default is options.database
   */
  existTable(table: string, database?: string): Promise<boolean>;

  /**
   * @param database 
   * @param table 
   * @param attrs 
   */
  getTableFields<T extends Object>(database: string, table: string, ...attrs: TableInfoColumn[]): Promise<T>;
}

export declare class TransactionOperator extends QueryOperator {
  /**
   * @example LOCK IN SHARE MODE
   * @example FOR UPDATE
   */
  append(suffix: string): this;
}

export type TransactionLevel = 'READ UNCOMMITTED' | 'RU'
  | 'READ COMMITTED' | 'RC'
  | 'REPEATABLE READ' | 'RR'
  | 'SERIALIZABLE' | 'S';

export declare class TransactionHandler {
  constructor(conn: PromiseConnection, options?: {
    level: TransactionLevel
  });

  query(options: QueryOptions): Promise<any>;

  execute(sql: string, values: any[]): Promise<any>;

  lastInsertId(alias?: string): Promise<number>;

  table(table: string, alias?: string | null): TransactionOperator;

  begin(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  upsert(tableName: string, data: any, condition: Record<string, ConditionValueType>): Promise<MySQLQueryResult>;
}

export function createClient(options: ConnectionOptions, name?: string | null | undefined): Connection;

export function getClient(name: string): Connection | Pool;

export function createPool(options: PoolOptions, name?: string | null | undefined): Pool;

export function createPromiseClient(options: ConnectionOptions, name?: string | null | undefined): PromiseConnection;

export declare class Hook {
  /**
   * pre hook for query operator
   */
  static pre: (
    callback: (options: QueryOperatorOptions, conn: Connection | Pool) => void,
    option?: { table?: string | string[], opt?: OperatorType | OperatorType[] }
  ) => void;

  /**
   * post hook for query operator
   */
  static post: (
    callback: (options: QueryOperatorOptions, result: QueryResult | Error, conn: Connection | Pool) => void,
    option?: { table?: string | string[], opt?: OperatorType | OperatorType[] }
  ) => void;

  /**
   * register hook
   */
  static register: (
    callback: (options: QueryOperatorOptions) => void,
    ...paths: string[]
  ) => void;

  /**
   * listen event
   */
  static listen: (
    options?: QueryOperatorOptions & { label?: string },
    ...args: any[]
  ) => void;

  /**
   * trigger event
   */
  static trigger: (
    paths: string[],
    ...args: any[]
  ) => void
}

export declare class Builder {
  sql: string;
  values: any[];
  constructor(options: QueryOperatorOptions);
}

export declare class MySQLClient extends QueryHandler {

  constructor(options?: ConnectionOptions, name?: string | null | undefined, type?: 'default' | 'promise' | 'pool');

  /**
   * @param query 
   * @param operator default is 'select'
   */
  execQuery(query: Query, operator?: OperatorType): Promise<QueryResult>;

  close(): Promise<void>;
}

type FieldType =
  'TINYINT' | 'SMALLINT' | 'MEDIUMINT' | 'INT' | 'BIGINT' | 'FLOAT' | 'DOUBLE' | 'DECIMAL' |
  'DATE' | 'TIME' | 'YEAR' | 'DATETIME' | 'TIMESTAMP' |
  'CHAR' | 'VARCHAR' | 'TINYBLOB' | 'TINYTEXT' | 'BLOB' | 'TEXT' | 'MEDIUMBLOB' | 'MEDIUMTEXT' |
  'LONGBLOB' | 'LONGTEXT' | 'ENUM' | 'SET' | 'JSON';

interface ColumnItem {
  type: FieldType,
  length?: number,
  precision?: number,
  unsigned?: boolean,
  allowNull?: boolean,
  default?: string | number | boolean | null | 'timestamp',
  onUpdate?: string,
  comment?: string,
  autoIncrement?: boolean,
  primaryKey?: boolean,
  uniqIndex?: boolean,
  references?: {
    table: string,
    column: string,
    onDelete?: CascadeType,
    onUpdate?: CascadeType
  }
}

interface CreateColumnOptions {
  length?: number,
  unsigned?: boolean,
  allowNull?: boolean,
  default?: string | number | boolean | null | 'timestamp',
  comment?: string,
  autoIncrement?: boolean,
  primaryKey?: boolean,
  uniqIndex?: boolean
}

interface CreateIndexOptions {
  unique?: boolean,
  fulltext?: boolean,
  spatial?: boolean
}

export declare class MigrationInterface {

  /**
   * @param tableName 
   * @param columns 
   * @param options default engine is InnoDB; default charset is utf8mb4
   */
  createTable(tableName: string, columns: Record<string, ColumnItem>, options?: {
    engine?: 'InnoDB' | 'MyISAM' | 'MEMORY',
    charset?: string
  }): void;

  /**
   * create column in table
   * @param columnName 
   * @param columnType 
   * @param tableName 
   * @param options allowNull default is true
   */
  createColumn(columnName: string, columnType: FieldType, tableName: string, options?: {
    length?: number,
    unsigned?: boolean,
    allowNull?: boolean,
    default?: string | number | boolean | null | 'timestamp',
    onUpdate?: string,
    comment?: string,
    autoIncrement?: boolean,
    primaryKey?: boolean,
    uniqIndex?: boolean,
    after?: string,
  }): void;

  /**
   * add column to table
   * @param tableName 
   * @param columnName 
   * @param options 
   */
  addColumn(tableName: string, columnName: string, options?: {
    type: FieldType,
  } & CreateColumnOptions): void;

  createIndex(tableName: string, columns: string[], options?: {
    indexName?: string,
    unique?: boolean,
    fulltext?: boolean,
    spatial?: boolean
  }): void;

  createForeignKey(options: {
    foreignKey?: string,
    tableName: string,
    columnName: string,
    reference: {
      tableName: string,
      columnName: string,
      onDelete?: CascadeType,
      onUpdate?: CascadeType,
    }
  }): void;

  dropTable(tableName: string): void;

  dropColumn(columnName: string, tableName: string): void;

  dropIndex(indexName: string): void;

  dropForeignKey(foreign_key: string, tableName: string): void;

  insertData(table: string, data: any[]): void;

  raw(sql: string, values: any[]): void;
}
