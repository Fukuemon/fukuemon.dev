/**
 * public のテーブル名と概算行数。
 * `reltuples` は `ANALYZE` が入るまで -1 なので、そのまま出さず負値で渡す。
 */
export const TABLES_SQL = `select c.relname as name, coalesce(c.reltuples::bigint, -1) as rows
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

/** 外部キー。ER のリレーションを引く */
export const RELATIONS_SQL = `select c.conname as name,
       src.relname as src, tgt.relname as tgt,
       pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_class tgt on tgt.oid = c.confrelid
join pg_namespace n on n.oid = src.relnamespace
where c.contype = 'f' and n.nspname = 'public'
order by src.relname, c.conname`;

export type Relation = { name: string; src: string; tgt: string; def: string };

/** 側柱の「試す」から実行パネルへ SQL を渡す。島が別なので事象で繋ぐ */
export const PRESET_EVENT = "lab:preset";
export type PresetEvent = CustomEvent<{ contentId: string; sql: string }>;
