import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MAX_ROWS, type SqlResponse, runSql, toSqlError } from "./index";

let pg: PGlite;

beforeAll(async () => {
  pg = await PGlite.create();
});

afterAll(async () => {
  await pg.close();
});

const results = (response: SqlResponse) => {
  if ("error" in response) throw new Error(response.error.message);
  return response.results;
};

describe("runSql", () => {
  it("select の結果を、列の名前と配列の行で返す", async () => {
    const [result] = results(await runSql(pg, "select 1 as a, 'x' as a"));
    expect(result).toEqual({
      fields: ["a", "a"],
      rows: [[1, "x"]],
      affectedRows: 1,
      totalRows: 1,
      truncated: false,
    });
  });

  it("複数の文の結果を、文ごとに返す", async () => {
    const response = await runSql(
      pg,
      "create table multi (id int); insert into multi values (1), (2); select * from multi;",
    );
    expect(results(response).map((r) => r.affectedRows)).toEqual([0, 2, 2]);
    expect(results(response)[2]?.rows).toEqual([[1], [2]]);
  });

  it("1 つの文が失敗したときは、前の文も取り消す", async () => {
    const response = await runSql(
      pg,
      "create table rolled (id int); insert into rolled values (1); select * from missing;",
    );
    expect("error" in response && response.error).toMatchObject({
      code: "42P01",
      position: expect.any(Number),
    });
    const after = await runSql(pg, "select to_regclass('rolled') is null as gone");
    expect(results(after)[0]?.rows).toEqual([[true]]);
  });

  it("失敗した後も、次の SQL を実行できる", async () => {
    await runSql(pg, "selec 1");
    expect(results(await runSql(pg, "select 2"))[0]?.rows).toEqual([[2]]);
  });

  it("VACUUM ANALYZE を 1 つの文で実行できる", async () => {
    await runSql(pg, "create table vac (id int); insert into vac select generate_series(1, 10);");
    expect("results" in (await runSql(pg, "vacuum analyze vac"))).toBe(true);
  });

  it("BEGIN と COMMIT を含む SQL を実行できる", async () => {
    const response = await runSql(
      pg,
      "begin; create table tx (id int); insert into tx values (1); commit; select count(*) from tx;",
    );
    expect(results(response).at(-1)?.rows).toEqual([[1]]);
  });

  it("EXPLAIN (ANALYZE, BUFFERS) の行に、実行の時間とバッファを含む", async () => {
    const [result] = results(await runSql(pg, "explain (analyze, buffers) select * from vac"));
    const text = result?.rows.map((row) => row[0]).join("\n");
    expect(result?.fields).toEqual(["QUERY PLAN"]);
    expect(text).toMatch(/cost=.*actual time=/);
    expect(text).toContain("Planning Time");
    expect(text).toContain("Execution Time");
  });

  it(`${MAX_ROWS} 行を超える結果は、先頭の ${MAX_ROWS} 行に切る`, async () => {
    const [result] = results(await runSql(pg, `select generate_series(1, ${MAX_ROWS + 1})`));
    expect(result?.rows).toHaveLength(MAX_ROWS);
    expect(result?.totalRows).toBe(MAX_ROWS + 1);
    expect(result?.truncated).toBe(true);
  });

  it("実行にかかった時間を返す", async () => {
    let tick = 0;
    const response = await runSql(pg, "select 1", () => (tick += 5));
    expect(response.ms).toBe(5);
  });
});

describe("toSqlError", () => {
  it("Error でない値は、文字列にする", () => {
    expect(toSqlError("boom")).toEqual({ message: "boom" });
  });

  it("code と position の無い Error は、メッセージだけを返す", () => {
    expect(toSqlError(new Error("closed"))).toEqual({ message: "closed" });
  });
});
