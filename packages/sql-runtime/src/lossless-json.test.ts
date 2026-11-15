import { PGlite, types } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSql, toJsonResponse } from "./index";
import { withLosslessJson } from "./lossless-json";

let pg: PGlite;

beforeAll(async () => {
  pg = await PGlite.create();
});

afterAll(async () => {
  await pg.close();
});

const rowsOf = async (sql: string, database = withLosslessJson(pg)) => {
  const response = await runSql(database, sql);
  if ("error" in response) throw new Error(response.error.message);
  return response.results.at(-1)?.rows;
};

describe("withLosslessJson", () => {
  it("jsonb の中の大きな整数の桁を落とさない", async () => {
    const rows = await rowsOf(`select '{"n": 9007199254740993}'::jsonb`);
    expect(rows).toStrictEqual([['{"n": 9007199254740993}']]);
  });

  it("json の中の大きな整数の桁を落とさず、書いたままの文字列で返す", async () => {
    const rows = await rowsOf(`select '{"n":   9007199254740993}'::json`);
    expect(rows).toStrictEqual([['{"n":   9007199254740993}']]);
  });

  it("json と jsonb の配列は、要素の桁を落とさず、引用符のない 1 つの文字列で返す。NULL の要素は null と書く", async () => {
    const rows = await rowsOf(
      `select array['{"n":9007199254740993}'::jsonb, null], array['{"n":9007199254740993}'::json]`,
    );
    expect(rows).toStrictEqual([['[{"n": 9007199254740993}, null]', '[{"n":9007199254740993}]']]);
  });

  it("多次元の配列も、入れ子の角括弧でつなぐ", async () => {
    const rows = await rowsOf(`select array[array['{"a": 1}'::jsonb], array['[2]'::jsonb]]`);
    expect(rows).toStrictEqual([['[[{"a": 1}], [[2]]]']]);
  });

  it("空の配列は [] で返す", async () => {
    const rows = await rowsOf("select '{}'::jsonb[]");
    expect(rows).toStrictEqual([["[]"]]);
  });

  it("json 以外の型と、jsonb の NULL は、PGlite の既定のまま返す", async () => {
    const rows = await rowsOf("select 1, 'x', null::jsonb");
    expect(rows).toStrictEqual([[1, "x", null]]);
  });

  it("呼び出しが渡した parsers を、既定より優先する", async () => {
    const database = withLosslessJson(pg);
    const results = await database.exec(`select '{"a":1}'::jsonb`, {
      rowMode: "array",
      parsers: { [types.JSONB]: () => "custom" },
    });
    expect(results[0]?.rows).toStrictEqual([["custom"]]);
  });

  it("DB のプロセスが送る JSON で往復しても、文字列のまま変わらない", async () => {
    const response = toJsonResponse(
      await runSql(withLosslessJson(pg), `select '{"n": 9007199254740993}'::jsonb`),
    );
    const rows = "results" in response ? response.results[0]?.rows : undefined;
    expect(JSON.parse(JSON.stringify(rows))).toStrictEqual([['{"n": 9007199254740993}']]);
  });

  it("EXPLAIN (FORMAT JSON) の結果は、JSON.parse すると Plan を持つ配列になる文字列で返す", async () => {
    const rows = await rowsOf("explain (format json) select 1");
    const plan: unknown = JSON.parse(String(rows?.[0]?.[0]));
    expect(plan).toMatchObject([{ Plan: { "Node Type": "Result" } }]);
  });
});
