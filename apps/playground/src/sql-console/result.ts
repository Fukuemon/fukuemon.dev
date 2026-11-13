import type { SqlResult } from "@fukuemon/sql-runtime";

export const PAGE_SIZES = [10, 50, 100, 500] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 100;

/** 結果の 1 つのセルを、表に出す文字列にする。NULL と空の文字列を見分けられるようにする。 */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value instanceof Uint8Array) {
    return `\\x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | bigint | boolean);
}

/** 行の数とページの大きさから、ページの数と、指定したページの行の範囲を返す。範囲の外のページは、端のページに寄せる。 */
export function pageRange(totalRows: number, pageSize: number, page: number) {
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  const current = Math.min(Math.max(page, 0), pages - 1);
  return {
    pages,
    page: current,
    start: current * pageSize,
    end: Math.min(totalRows, (current + 1) * pageSize),
  };
}

/**
 * 結果の 1 ページを、表に出す列と行にする。行と列は ID を持たないので、結果の中の位置を key にする。
 * 結果は実行のたびに作り直し、表も作り直すので、位置の key で行が入れ替わることは無い。
 */
export function tablePage(result: SqlResult, pageSize: number, page: number) {
  const range = pageRange(result.rows.length, pageSize, page);
  return {
    ...range,
    columns: result.fields.map((name, column) => ({ key: `c${column}`, name })),
    rows: result.rows.slice(range.start, range.end).map((row, offset) => {
      const key = `r${range.start + offset}`;
      return {
        key,
        cells: row.map((value, column) => ({ key: `${key}c${column}`, text: formatCell(value) })),
      };
    }),
  };
}
