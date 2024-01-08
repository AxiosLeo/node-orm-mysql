type QueryItem = {
  sql: string,
  values: any[],
};

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
