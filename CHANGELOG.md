# Changelog

## 0.15.2 (2026-06-12)

### Fixed

- **Data correctness: `IN` conditions silently matched zero rows on the transaction path.**

  In 0.15.0 / 0.15.1, `whereIn()` / `whereNotIn()` / `where(field, 'IN', array)` executed
  through `TransactionHandler` silently returned an empty result set (SELECT) or affected
  0 rows (UPDATE / DELETE), without any error. The same query worked fine through
  `QueryHandler`.

  Root cause: the SQL builder bound the whole array as a single value, producing
  `WHERE \`id\` IN (?)` with values `[[1, 2]]`. The non-transaction path uses
  `conn.query()` (client-side interpolation), which happens to expand array parameters
  into `IN (1, 2)`. The transaction path uses `conn.execute()` (server-side prepared
  statement), which never expands arrays, so the condition matched nothing.

  Fix: `Builder` now emits one placeholder per array element (`IN (?,?)`) and binds flat
  scalar values, so `query` and `execute` behave identically. The transaction path keeps
  using prepared statements (`conn.execute`).

- The same array-as-single-bind pattern was fixed in the JSON branches: `key->'$.path'`
  with `IN` / `NOT IN`, `CONTAIN` / `NOT CONTAIN` and `OVERLAPS` / `NOT OVERLAPS` now
  expand arrays into `JSON_ARRAY(?,?,...)` with scalar bindings.

- Comma-separated string values for `IN` (e.g. `whereIn('id', '1,2,3')`, documented in
  `index.d.ts`) previously threw `Value must be an array or sub-query for "IN" condition`;
  they are now split, trimmed and expanded like arrays.

### Unchanged behavior

- Empty arrays (and now empty strings) for `IN` still throw
  `Value must not be empty for "IN" condition`.
- `Query` sub-queries for `IN` still render the sub-select SQL.
