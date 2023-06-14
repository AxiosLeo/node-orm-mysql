import {
  Pool,
  OkPacket,
  Connection,
  PoolOptions,
  QueryOptions,
  RowDataPacket,
  ConnectionOptions
} from 'mysql2';

import {
  Connection as PromiseConnection,
} from 'mysql2/promise';

export type Clients = {
  [key: string]: Connection
}

export type BasicValueType = null | string | number | boolean | Date;
export type ConditionValueType = BasicValueType | Array<string | number | boolean | Date> | Query;

export type OptType = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE'
  | 'NOT LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'NOT BETWEEN' | 'IS' | 'IS NOT' | 'REGEXP' | 'NOT REGEXP'
  | 'AND' | 'OR' | 'GROUP' | 'like' | 'not like' | 'in' | 'not in' | 'between' | 'not between' | 'is' | 'is not' | 'regexp' | 'not regexp' | 'group';

export interface WhereOptions {
  key: string | null;
  opt: OptType;
  value: ConditionValueType | WhereOptions[];
}

export interface OrderByOptions {
  sortField: string,
  sortOrder: 'asc' | 'desc'
}

export type OperatorType = 'select' | 'find' | 'insert' | 'update' | 'delete' | 'count';

export interface JoinOption {
  table: string | Query;
  table_alias?: string;
  self_column: string;
  foreign_column: string;
  join_type?: 'left' | 'right' | 'inner';
}

export interface TableOption {
  tableName: string;
  alias: string | null;
}

export interface QueryOperatorOptions {
  conditions: WhereOptions[];
  attrs?: string[] | null;
  orders: OrderByOptions[];
  pageLimit?: number;
  pageOffset?: number;
  tables: TableOption[];
  operator: OperatorType | null;
  data: any | null;
  groupField: string[];
  joins: JoinOption[];
  having: WhereOptions[];
  suffix?: string | null;
  transaction: boolean;
}

export declare class Query<T extends Entity = any> {
  constructor(operator?: OperatorType);

  table(tableName: string, alias: string | null): this;

  limit(limit: number): this;

  offset(offset: number): this;

  where<K extends EntityKey<T>>(key: K | null, value: EntityValue<T, K> | WhereOptions[], opt?: OptType): this;

  whereObject(obj: Partial<T>): this;

  whereConditions(...condition: WhereOptions[]): this;

  orWhere<K extends EntityKey<T>>(key: K | null, opt: OptType, value: EntityValue<T, K> | WhereOptions[]): this;

  andWhere<K extends EntityKey<T>>(key: K | null, opt: OptType, value: EntityValue<T, K> | WhereOptions[]): this;

  attr(...attr: string[]): this;

  orderBy(sortField: EntityKey<T>, sortOrder: 'asc' | 'desc'): this;

  groupBy(...groupField: EntityKey<T>[]): this;

  having<K extends EntityKey<T>>(key: K | null, opt: OptType, value: EntityValue<T, K> | WhereOptions[]): this;

  page(limit: number, offset?: number): this;

  /* ?? */
  set(data: any): this;

  /* TODO: JoinOption 泛型 */
  join(opt: JoinOption): this;
}

export type QueryResult = any | undefined | RowDataPacket[] | RowDataPacket | OkPacket;

export declare class QueryOperator<T extends Entity> extends Query {
  conn: Connection;
  options: QueryOperatorOptions

  constructor(conn: Connection);

  buildSql(operator: OperatorType): { sql: string, values: any[] };

  exec(): Promise<QueryResult>;

  select(): Promise<T[]>;

  find(): Promise<T>;

  update(data?: Partial<T>): Promise<OkPacket>;

  insert(data?: T): Promise<OkPacket>;

  count(): Promise<number>;

  /**
   * delete data
   * @param id 
   * @param index_field_name default is 'id'
   */
  delete(id?: number, index_field_name?: string): Promise<OkPacket>;
}

export declare type Entity = Record<string, BasicValueType>;

export declare type EntityKey<T extends Entity> = keyof T;

export declare type EntityValue<T extends Entity, K extends EntityKey<T>> = T[K];

export declare type TableMap = Record<string, Entity>;

export declare type TableName<T extends TableMap> = keyof T;

export declare type TableEntity<T extends TableMap, N extends string> = T[N];
export declare class QueryHandler<TM extends TableMap> {
  conn: Connection;

  constructor(conn: Connection);

  table<T extends TableName<TM>>(table: T, alias?: string | null): QueryOperator<TableEntity<TM, T>>;

  query(options: QueryOptions): Promise<any>;

  upsert(tableName: string, data: any, condition: Record<string, ConditionValueType>): Promise<OkPacket>;
}

export declare class TransactionOperator<T extends Entity = any> extends QueryOperator<T> {
  append(suffix: string): this;
}

export type TransactionLevel = 'READ UNCOMMITTED' | 'RU'
  | 'READ COMMITTED' | 'RC'
  | 'REPEATABLE READ' | 'RR'
  | 'SERIALIZABLE' | 'S';

export declare class TransactionHandler<T extends Entity = any> {
  constructor(conn: PromiseConnection, options?: {
    level: TransactionLevel
  });

  query(options: QueryOptions): Promise<any>;

  execute(sql: string, values: any[]): Promise<any>;

  lastInsertId(alias?: string): Promise<number>;

  table(table: string, alias?: string | null): TransactionOperator<T>;

  begin(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  upsert(tableName: string, data: T, condition: Record<string, ConditionValueType>): Promise<OkPacket>;
}

export function createClient(options: ConnectionOptions, name?: string | null | undefined): Connection;

export function getClient(name: string): Connection;

export function createPool(options: PoolOptions, name?: string | null | undefined): Pool;

export function createPromiseClient(options: ConnectionOptions, name?: string | null | undefined): PromiseConnection;

export declare class Hook {
  static pre: (
    callback: (options: QueryOperatorOptions) => void,
    option: { table?: string, opt?: OperatorType }
  ) => string;

  static post: (
    callback: (options: QueryOperatorOptions, result: QueryResult | Error) => void,
    option: { table?: string, opt?: OperatorType }
  ) => string;
}
