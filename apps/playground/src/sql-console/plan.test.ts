import type { SqlResult } from "@fukuemon/sql-runtime";
import { describe, expect, it } from "vitest";

import { toPlanView } from "./plan";

const result = (fields: string[], rows: unknown[][]): SqlResult => ({
  fields,
  rows,
  affectedRows: rows.length,
  totalRows: rows.length,
  truncated: false,
});

const planResult = (cell: unknown) => result(["QUERY PLAN"], [[cell]]);

// PGlite 0.5.16 の explain (analyze, buffers, format json) の出力から、使うキーを残した
const jsonPlan = [
  {
    Plan: {
      "Node Type": "Sort",
      "Startup Cost": 8.58,
      "Total Cost": 8.6,
      "Plan Rows": 9,
      "Plan Width": 8,
      "Actual Startup Time": 0.156,
      "Actual Total Time": 0.161,
      "Actual Rows": 9,
      "Actual Loops": 1,
      "Shared Hit Blocks": 3,
      "Shared Read Blocks": 0,
      Plans: [
        {
          "Node Type": "Index Scan",
          "Index Name": "users_pkey",
          "Relation Name": "users",
          Alias: "u",
          "Startup Cost": 0.28,
          "Total Cost": 8.43,
          "Plan Rows": 9,
          "Plan Width": 8,
          "Shared Hit Blocks": 2,
          "Shared Read Blocks": 1,
        },
      ],
    },
    "Planning Time": 0.21,
    "Execution Time": 0.227,
  },
];

const jsonView = {
  kind: "json",
  plan: {
    root: {
      id: "0",
      label:
        "Sort (cost=8.58..8.6 rows=9 width=8) (actual time=0.156..0.161 rows=9 loops=1) Buffers: shared hit=3",
      children: [
        {
          id: "0.0",
          label:
            "Index Scan using users_pkey on users u (cost=0.28..8.43 rows=9 width=8) Buffers: shared hit=2 read=1",
        },
      ],
    },
    planningMs: 0.21,
    executionMs: 0.227,
  },
};

describe("toPlanView", () => {
  it.each([
    ["列が QUERY PLAN でない結果", result(["id"], [[1]])],
    ["列が 2 つの結果", result(["QUERY PLAN", "x"], [["a", 1]])],
  ])("%s は、実行計画にしない", (_, value) => {
    expect(toPlanView(value)).toBeUndefined();
  });

  it("テキストの実行計画は、行をつないだテキストにする", () => {
    const rows = [["Seq Scan on t  (cost=0.00..1.00 rows=1 width=4)"], ["Planning Time: 0.1 ms"]];
    expect(toPlanView(result(["QUERY PLAN"], rows))).toStrictEqual({
      kind: "text",
      text: "Seq Scan on t  (cost=0.00..1.00 rows=1 width=4)\nPlanning Time: 0.1 ms",
    });
  });

  it("FORMAT JSON の実行計画は、ノードの木と時間にする", () => {
    expect(toPlanView(planResult(jsonPlan))).toStrictEqual(jsonView);
  });

  it("文字列で受け取った FORMAT JSON も、ノードの木と時間にする", () => {
    expect(toPlanView(planResult(JSON.stringify(jsonPlan)))).toStrictEqual(jsonView);
  });

  it("JSON として読めない 1 行は、テキストにする", () => {
    expect(toPlanView(planResult("Result  (cost=0.00..0.01 rows=1 width=4)"))).toStrictEqual({
      kind: "text",
      text: "Result  (cost=0.00..0.01 rows=1 width=4)",
    });
  });

  it("Plan を持たない JSON は、JSON の文字列のテキストにする", () => {
    expect(toPlanView(planResult([{ NoPlan: true }]))).toStrictEqual({
      kind: "text",
      text: '[{"NoPlan":true}]',
    });
  });

  it("Bitmap Index Scan のインデックスは、on で書く", () => {
    const cell = [{ Plan: { "Node Type": "Bitmap Index Scan", "Index Name": "idx" } }];
    expect(toPlanView(planResult(cell))).toStrictEqual({
      kind: "json",
      plan: { root: { id: "0", label: "Bitmap Index Scan on idx" } },
    });
  });

  it("ノードの種類の無いノードは、? で出す", () => {
    expect(toPlanView(planResult([{ Plan: {} }]))).toStrictEqual({
      kind: "json",
      plan: { root: { id: "0", label: "?" } },
    });
  });
});
