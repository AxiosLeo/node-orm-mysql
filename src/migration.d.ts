import { ColumnItem } from '../index';

type QueryItem = {
  sql: string,
  values: any[],
};

export type ManageBuilderOptions = {
  operator: 'create' | 'drop' | 'alter';
  columns: Record<string, ColumnItem>;
  target: 'table' | 'column' | 'index' | 'foreign_key';
  name?: string;
  engine?: 'InnoDB' | 'MyISAM' | 'MEMORY',
  charset?: string
}

export type Context = {
  action: 'up' | 'down',
  connection: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  },
  items: string[],
  task_key: string,
  config: {
    dir: string,
  },
  files: [],
  runtime?: {
    script: string,
    queries: QueryItem[],
  },
};
