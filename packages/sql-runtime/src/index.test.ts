import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  MAX_ROWS,
  type SqlResponse,
  keepLastRows,
  runSql,
  toJsonResponse,
  toSqlError,
} from "./index";

let pg: PGlite;

beforeAll(async () => {
  pg = await PGlite.create();
});

afterAll(async () => {
  await pg.close();
});

const lastRows = (response: SqlResponse) =>
  "error" in response ? response.error : response.results.at(-1)?.rows;

describe("runSql", () => {
  it("select の結果を、重なる列の名前も残して、配列の行で返す", async () => {
    const response = await runSql(pg, "select 1 as a, 'x' as a", () => 0);
    expect(response).toStrictEqual({
      results: [
        { fields: ["a", "a"], rows: [[1, "x"]], affectedRows: 1, totalRows: 1, truncated: false },
      ],
      ms: 0,
    });
  });

  it("複数の文の結果を、文ごとに返す", async () => {
    const response = await runSql(
      pg,
      "create table multi (id int); insert into multi values (1), (2); select * from multi;",
    );
    expect(
      "results" in response && response.results.map((r) => [r.affectedRows, r.rows]),
    ).toStrictEqual([
      [0, []],
      [2, []],
      [2, [[1], [2]]],
    ]);
  });

  it("1 つの文が失敗したときは、エラーのコードと位置を返す", async () => {
    const response = await runSql(pg, "select * from missing", () => 0);
    expect(response).toStrictEqual({
      error: { message: 'relation "missing" does not exist', code: "42P01", position: 15 },
      ms: 0,
    });
  });

  it("1 つの文が失敗したときは、前の文も取り消す", async () => {
    await runSql(
      pg,
      "create table rolled (id int); insert into rolled values (1); select * from missing;",
    );
    const after = await runSql(pg, "select to_regclass('rolled') is null as gone");
    expect(lastRows(after)).toStrictEqual([[true]]);
  });

  it("失敗した後も、次の SQL を実行できる", async () => {
    await runSql(pg, "selec 1");
    expect(lastRows(await runSql(pg, "select 2"))).toStrictEqual([[2]]);
  });

  it("BEGIN の後の文が失敗しても、次の SQL を実行できる", async () => {
    await runSql(pg, "begin; select * from missing;");
    expect(lastRows(await runSql(pg, "select 3"))).toStrictEqual([[3]]);
  });

  it("ROLLBACK も失敗するときは、元のエラーを返す", async () => {
    const broken = { exec: () => Promise.reject(new Error("broken")) };
    expect(await runSql(broken, "select 1", () => 0)).toStrictEqual({
      error: { message: "broken" },
      ms: 0,
    });
  });

  it("VACUUM ANALYZE を 1 つの文で実行できる", async () => {
    await runSql(pg, "create table vac (id int); insert into vac select generate_series(1, 10);");
    expect(lastRows(await runSql(pg, "vacuum analyze vac"))).toStrictEqual([]);
  });

  it("BEGIN と COMMIT を含む SQL を実行できる", async () => {
    const response = await runSql(
      pg,
      "begin; create table tx (id int); insert into tx values (1); commit; select count(*)::int from tx;",
    );
    expect(lastRows(response)).toStrictEqual([[1]]);
  });

  it("EXPLAIN (ANALYZE, BUFFERS) の行に、見積もり、実測、バッファ、計画と実行の時間を含む", async () => {
    const response = await runSql(
      pg,
      "create table plan (id int); insert into plan select generate_series(1, 100); explain (analyze, buffers) select * from plan;",
    );
    const text =
      "results" in response
        ? response.results
            .at(-1)
            ?.rows.map((row) => row[0])
            .join("\n")
        : "";
    expect(
      ["cost=", "actual time=", "Buffers:", "Planning Time", "Execution Time"].filter(
        (word) => !text?.includes(word),
      ),
    ).toStrictEqual([]);
  });

  it(`${MAX_ROWS} 行を超える結果は、先頭の ${MAX_ROWS} 行に切る`, async () => {
    const response = await runSql(pg, `select generate_series(1, ${MAX_ROWS + 1})`);
    const result = "results" in response ? response.results[0] : undefined;
    expect({
      rows: result?.rows.length,
      totalRows: result?.totalRows,
      truncated: result?.truncated,
    }).toStrictEqual({ rows: MAX_ROWS, totalRows: MAX_ROWS + 1, truncated: true });
  });

  it("実行にかかった時間を返す", async () => {
    let tick = 0;
    const response = await runSql(pg, "select 1", () => (tick += 5));
    expect(response.ms).toBe(5);
  });
});

describe("keepLastRows", () => {
  const result = (rows: unknown[][]) => ({
    fields: ["a"],
    rows,
    affectedRows: rows.length,
    totalRows: rows.length,
    truncated: false,
  });

  it("最後の文のほかの結果から、行を除く", () => {
    const response = { results: [result([[1], [2]]), result([[3]])], ms: 1 };
    expect(keepLastRows(response)).toStrictEqual({
      results: [{ ...result([[1], [2]]), rows: [] }, result([[3]])],
      ms: 1,
    });
  });

  it("エラーは、そのまま返す", () => {
    const response = { error: { message: "x" }, ms: 0 };
    expect(keepLastRows(response)).toBe(response);
  });
});

describe("toSqlError", () => {
  it("Error でない値は、文字列にする", () => {
    expect(toSqlError("boom")).toStrictEqual({ message: "boom" });
  });

  it("code と position の無い Error は、メッセージだけを返す", () => {
    expect(toSqlError(new Error("closed"))).toStrictEqual({ message: "closed" });
  });
});

describe("toJsonResponse", () => {
  it("JSON で型が残らない値を、表に出す文字列にし、JSON で往復しても変わらない値にする", async () => {
    const response = toJsonResponse(
      await runSql(
        pg,
        "select 9007199254740993::int8, '2020-01-02T03:04:05Z'::timestamptz, '\\x0aff'::bytea, array[9007199254740993::int8], '{\"a\":1}'::jsonb, null, 1",
      ),
    );
    const rows = "results" in response ? response.results[0]?.rows : undefined;
    expect(rows).toStrictEqual([
      [
        "9007199254740993",
        "2020-01-02T03:04:05.000Z",
        "\\x0aff",
        ["9007199254740993"],
        { a: 1 },
        null,
        1,
      ],
    ]);
    expect(JSON.parse(JSON.stringify(response))).toStrictEqual(response);
  });

  it("失敗の応答は、そのまま返す", () => {
    const failed = { error: { message: "x" }, ms: 1 };
    expect(toJsonResponse(failed)).toBe(failed);
  });
});
