import { PGlite } from "@electric-sql/pglite";
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

  it("json と jsonb の配列の要素も、桁を落とさない。NULL の要素は null のまま返す", async () => {
    const rows = await rowsOf(
      `select array['{"n":9007199254740993}'::jsonb, null], array['{"n":9007199254740993}'::json]`,
    );
    expect(rows).toStrictEqual([[['{"n": 9007199254740993}', null], ['{"n":9007199254740993}']]]);
  });

  it("json 以外の型は、PGlite の既定のまま返す", async () => {
    const rows = await rowsOf("select 1, 'x', null::jsonb");
    expect(rows).toStrictEqual([[1, "x", null]]);
  });

  it("呼び出しが渡した parsers を、既定より優先する", async () => {
    const database = withLosslessJson(pg);
    const results = await database.exec(`select '{"a":1}'::jsonb`, {
      rowMode: "array",
      parsers: { 3802: () => "custom" },
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

  it("使わない PGlite は、今までどおり桁が落ちる", async () => {
    const rows = await rowsOf(`select '{"n": 9007199254740993}'::jsonb`, pg);
    expect(rows).toStrictEqual([[{ n: 9007199254740992 }]]);
  });
});
