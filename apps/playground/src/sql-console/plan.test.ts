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

describe("toPlanView", () => {
  it("QUERY PLAN の 1 列でない結果は、実行計画にしない", () => {
    expect(toPlanView(result(["id"], [[1]]))).toBeUndefined();
    expect(toPlanView(result(["QUERY PLAN", "x"], [["a", 1]]))).toBeUndefined();
  });

  it("テキストの実行計画は、行をつないだテキストにする", () => {
    const rows = [["Seq Scan on t  (cost=0.00..1.00 rows=1 width=4)"], ["Planning Time: 0.1 ms"]];
    expect(toPlanView(result(["QUERY PLAN"], rows))).toEqual({
      kind: "text",
      text: "Seq Scan on t  (cost=0.00..1.00 rows=1 width=4)\nPlanning Time: 0.1 ms",
    });
  });

  it("FORMAT JSON の実行計画は、ノードの木と時間にする", () => {
    expect(toPlanView(result(["QUERY PLAN"], [[jsonPlan]]))).toEqual({
      kind: "json",
      plan: {
        planningMs: 0.21,
        executionMs: 0.227,
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
      },
    });
  });

  it("文字列で受け取った FORMAT JSON も、木にする", () => {
    const view = toPlanView(result(["QUERY PLAN"], [[JSON.stringify(jsonPlan)]]));
    expect(view?.kind).toBe("json");
  });

  it("JSON として読めない 1 行は、テキストにする", () => {
    expect(
      toPlanView(result(["QUERY PLAN"], [["Result  (cost=0.00..0.01 rows=1 width=4)"]])),
    ).toEqual({ kind: "text", text: "Result  (cost=0.00..0.01 rows=1 width=4)" });
    expect(toPlanView(result(["QUERY PLAN"], [[[{ NoPlan: true }]]]))?.kind).toBe("text");
  });

  it("Bitmap Index Scan のインデックスは、on で書く", () => {
    const view = toPlanView(
      result(
        ["QUERY PLAN"],
        [[[{ Plan: { "Node Type": "Bitmap Index Scan", "Index Name": "idx" } }]]],
      ),
    );
    expect(view?.kind === "json" && view.plan.root.label).toBe("Bitmap Index Scan on idx");
  });

  it("ノードの種類の無いノードは、? で出す", () => {
    const view = toPlanView(result(["QUERY PLAN"], [[[{ Plan: {} }]]]));
    expect(view).toEqual({ kind: "json", plan: { root: { id: "0", label: "?" } } });
  });
});
