import { cellText } from "../runtime/cell";
import { serialize, type Runtime } from "../runtime/runtime";

export type Table = { name: string; rows: number };
export type Column = { name: string; type: string; nullable: boolean; pk: boolean };
export type Relation = { name: string; src: string; tgt: string; def: string };

/** `reltuples` は ANALYZE が入るまで -1。負値のまま渡し、呼ぶ側が断る */
const TABLES_SQL = `select c.relname as name, coalesce(c.reltuples::bigint, -1) as rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
order by c.relname`;

const COLUMNS_SQL = `select a.attname as name,
       format_type(a.atttypid, a.atttypmod) as type,
       not a.attnotnull as nullable,
       coalesce(i.indisprimary, false) as pk
from pg_attribute a
left join pg_index i
  on i.indrelid = a.attrelid and a.attnum = any(i.indkey) and i.indisprimary
where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum`;

const RELATIONS_SQL = `select c.conname as name,
       src.relname as src, tgt.relname as tgt,
       pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_class tgt on tgt.oid = c.confrelid
join pg_namespace n on n.oid = src.relnamespace
where c.contype = 'f' and n.nspname = 'public'
order by src.relname, c.conname`;

const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const quoteLiteral = (v: string) => `'${v.replaceAll("'", "''")}'`;

const rowsOf = async (rt: Runtime, sql: string): Promise<unknown[][]> => {
  const { results } = await serialize(() => rt.exec(sql));
  return results.at(-1)?.rows ?? [];
};

export async function fetchTables(rt: Runtime): Promise<Table[]> {
  const rows = await rowsOf(rt, TABLES_SQL);
  return rows.map((r) => ({ name: cellText(r[0] ?? ""), rows: Number(r[1] ?? 0) }));
}

export async function fetchRelations(rt: Runtime): Promise<Relation[]> {
  const rows = await rowsOf(rt, RELATIONS_SQL);
  return rows.map((r) => ({
    name: cellText(r[0] ?? ""),
    src: cellText(r[1] ?? ""),
    tgt: cellText(r[2] ?? ""),
    def: cellText(r[3] ?? ""),
  }));
}

/** `table` はカタログ由来の名前だけを渡す。読者の入力をここへ通さない */
export async function fetchColumns(rt: Runtime, table: string): Promise<Column[]> {
  const rows = await rowsOf(rt, COLUMNS_SQL.replace("$1", quoteLiteral(table)));
  return rows.map((r) => ({
    name: cellText(r[0] ?? ""),
    type: cellText(r[1] ?? ""),
    nullable: r[2] === true,
    pk: r[3] === true,
  }));
}

export async function fetchRows(
  rt: Runtime,
  table: string,
  limit: number,
): Promise<{ head: string[]; rows: unknown[][] }> {
  const { results } = await serialize(() =>
    rt.exec(`select * from ${quoteIdentifier(table)} limit ${limit}`),
  );
  const last = results.at(-1);
  return { head: last?.fields.map((f) => f.name) ?? [], rows: last?.rows ?? [] };
}
