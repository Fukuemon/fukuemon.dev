import { cellText } from "../runtime/cell";
import { serialize, type Runtime } from "../runtime/runtime";
import COLUMNS_SQL from "./sql/columns.sql?raw";
import RELATIONS_SQL from "./sql/relations.sql?raw";
import TABLES_SQL from "./sql/tables.sql?raw";

declare const nameBrand: unique symbol;

/**
 * カタログが返したテーブル名。
 * `fetchRows` は識別子を SQL へ埋めるので、読者が入力した文字列を受け取らせない
 */
export type TableName = string & { readonly [nameBrand]: "TableName" };

export type Table = { name: TableName; rows: number };
export type Column = { name: string; type: string; nullable: boolean; pk: boolean };
export type Relation = { name: string; src: string; tgt: string; def: string };

const MAX_LIMIT = 1000;

const quoteIdentifier = (name: TableName) => `"${name.replaceAll('"', '""')}"`;

const rowsOf = async (rt: Runtime, sql: string): Promise<unknown[][]> => {
  const { results } = await serialize(() => rt.exec(sql));
  return results.at(-1)?.rows ?? [];
};

export async function fetchTables(rt: Runtime): Promise<Table[]> {
  const rows = await rowsOf(rt, TABLES_SQL);
  return rows.map((r) => ({ name: cellText(r[0] ?? "") as TableName, rows: Number(r[1] ?? 0) }));
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

/** public の全テーブルの列を 1 回で取り、テーブル名ごとに束ねる */
export async function fetchColumnsByTable(rt: Runtime): Promise<Map<string, Column[]>> {
  const rows = await rowsOf(rt, COLUMNS_SQL);
  const out = new Map<string, Column[]>();
  for (const r of rows) {
    const table = cellText(r[0] ?? "");
    const list = out.get(table) ?? [];
    list.push({
      name: cellText(r[1] ?? ""),
      type: cellText(r[2] ?? ""),
      nullable: r[3] === true,
      pk: r[4] === true,
    });
    out.set(table, list);
  }
  return out;
}

export async function fetchRows(
  rt: Runtime,
  table: TableName,
  limit: number,
): Promise<{ head: string[]; rows: unknown[][] }> {
  const n = Number.isFinite(limit) ? Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT) : 1;
  const { results } = await serialize(() =>
    rt.exec(`select * from ${quoteIdentifier(table)} limit ${n}`),
  );
  const last = results.at(-1);
  return { head: last?.fields.map((f) => f.name) ?? [], rows: last?.rows ?? [] };
}
