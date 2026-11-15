import { type PGliteInterface, types } from "@electric-sql/pglite";

type Database = Pick<PGliteInterface, "exec">;

const text: types.Parser = (value) => value;
const textArray: types.Parser = (value) => types.arrayParser(value, text, 0);

// PGlite の既定は、json と jsonb を JSON.parse する。安全な整数の範囲を超える値は、桁を落とす
const PARSERS = {
  [types.JSON]: text,
  [types.JSONB]: text,
  199: textArray,
  3807: textArray,
};

/**
 * json と jsonb の値を、パースせず、Postgres が返す文字列のまま返す PGlite にする。
 * 結果の表は、文字列をそのまま出すので、`9007199254740993` のような大きな整数の桁が落ちない。
 */
export function withLosslessJson(pg: Database): Database {
  return {
    exec: (sql, options) =>
      pg.exec(sql, { ...options, parsers: { ...PARSERS, ...options?.parsers } }),
  };
}
