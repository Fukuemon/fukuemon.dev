import { toJsonResponse } from "@fukuemon/sql-runtime";
import { describe, expect, it } from "vitest";

import { formatCell, pageRange, tablePage } from "./result";

describe("formatCell", () => {
  it.each([
    [null, "NULL"],
    [undefined, "NULL"],
    ["", ""],
    [42, "42"],
    [true, "true"],
    [10n, "10"],
    [new Date("2026-11-13T00:00:00Z"), "2026-11-13T00:00:00.000Z"],
    [new Date(Number.NaN), "Invalid Date"],
    [new Uint8Array([0, 255]), "\\x00ff"],
    [{ a: [1] }, '{"a":[1]}'],
    [[9223372036854775807n], '["9223372036854775807"]'],
  ])("%o を %s で出す", (value, expected) => {
    expect(formatCell(value)).toBe(expected);
  });
});

describe("pageRange", () => {
  it("指定したページの行の範囲を返す", () => {
    expect(pageRange(250, 100, 2)).toStrictEqual({ pages: 3, page: 2, start: 200, end: 250 });
  });

  it.each([
    ["最後より後のページ", 9, 2],
    ["負のページ", -1, 0],
  ])("%s は、端のページに寄せる", (_, page, expected) => {
    expect(pageRange(250, 100, page).page).toBe(expected);
  });

  it("行が無いときも、1 ページにする", () => {
    expect(pageRange(0, 100, 0)).toStrictEqual({ pages: 1, page: 0, start: 0, end: 0 });
  });
});

describe("tablePage", () => {
  it("1 ページの行を、結果の中の位置の key と、表に出す文字列にする", () => {
    const result = {
      fields: ["a", "a"],
      rows: [
        [1, null],
        [2, "x"],
        [3, "y"],
      ],
      affectedRows: 3,
      totalRows: 3,
      truncated: false,
    };
    expect(tablePage(result, 2, 1)).toStrictEqual({
      pages: 2,
      page: 1,
      start: 2,
      end: 3,
      columns: [
        { key: "c0", name: "a" },
        { key: "c1", name: "a" },
      ],
      rows: [
        {
          key: "r2",
          cells: [
            { key: "r2c0", text: "3" },
            { key: "r2c1", text: "y" },
          ],
        },
      ],
    });
  });
});

describe("formatCell と toJsonResponse", () => {
  const cells = [
    9007199254740993n,
    new Date("2020-01-02T03:04:05Z"),
    new Date(Number.NaN),
    new Uint8Array([10, 255]),
    Number.NaN,
    Number.POSITIVE_INFINITY,
    [9007199254740993n, new Date("2020-01-02T03:04:05Z")],
    { a: 1, b: [new Uint8Array([1])] },
    null,
    "text",
    1.5,
    true,
  ];

  it("DB のプロセスが JSON で送ったセルを、Web Worker の値と同じ文字列で出す", () => {
    const response = toJsonResponse({
      results: [{ fields: [], rows: [cells], affectedRows: 0, totalRows: 1, truncated: false }],
      ms: 0,
    });
    // DB のプロセスは標準出力に書き、ページはその行を読む
    const line = JSON.stringify(response);
    const sent = JSON.parse(line) as { results: { rows: unknown[][] }[] };
    expect(sent.results[0]?.rows[0]?.map(formatCell)).toStrictEqual(cells.map(formatCell));
  });
});
