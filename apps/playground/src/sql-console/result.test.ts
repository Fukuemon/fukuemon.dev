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
  ])("%o を %s で出す", (value, expected) => {
    expect(formatCell(value)).toBe(expected);
  });
});

describe("pageRange", () => {
  it("指定したページの行の範囲を返す", () => {
    expect(pageRange(250, 100, 2)).toEqual({ pages: 3, page: 2, start: 200, end: 250 });
  });

  it("範囲の外のページは、端のページに寄せる", () => {
    expect(pageRange(250, 100, 9).page).toBe(2);
    expect(pageRange(250, 100, -1).page).toBe(0);
  });

  it("行が無いときも、1 ページにする", () => {
    expect(pageRange(0, 100, 0)).toEqual({ pages: 1, page: 0, start: 0, end: 0 });
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
    const page = tablePage(result, 2, 1);
    expect(page.columns).toEqual([
      { key: "c0", name: "a" },
      { key: "c1", name: "a" },
    ]);
    expect(page.rows).toEqual([
      {
        key: "r2",
        cells: [
          { key: "r2c0", text: "3" },
          { key: "r2c1", text: "y" },
        ],
      },
    ]);
  });
});
