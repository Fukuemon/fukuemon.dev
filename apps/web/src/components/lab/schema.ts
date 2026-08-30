/** public のテーブル名と概算行数 */
export const TABLES_SQL = `select c.relname as name, coalesce(c.reltuples::bigint, 0) as rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
order by c.relname`;

/** 1 テーブルの列。型・NULL 可否・主キーかどうか */
export const COLUMNS_SQL = `select a.attname as name,
       format_type(a.atttypid, a.atttypmod) as type,
       not a.attnotnull as nullable,
       coalesce(i.indisprimary, false) as pk
from pg_attribute a
left join pg_index i
  on i.indrelid = a.attrelid and a.attnum = any(i.indkey) and i.indisprimary
where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum`;

export type Table = { name: string; rows: number };
export type Column = { name: string; type: string; nullable: boolean; pk: boolean };

/** 実行パネルが走り終えた合図。`DbPeek` が一覧を引き直す */
export const RAN_EVENT = "lab:ran";
export type RanEvent = CustomEvent<{ contentId: string }>;
