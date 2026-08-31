import { describe, expect, it } from "vitest";
import {
  fetchColumnsByTable,
  fetchRelations,
  fetchRows,
  fetchTables,
  type TableName,
} from "./catalog";
import type { Runtime } from "../runtime/runtime";

const name = (s: string) => s as TableName;

/** 送られた SQL を記録し、渡された行をそのまま返す */
function stub(rows: unknown[][] = [], fields: string[] = []) {
  const sent: string[] = [];
  const rt: Runtime = {
    version: "test",
    replayFailed: [],
    exec: (source) => {
      sent.push(source);
      return Promise.resolve({
        results: [
          { fields: fields.map((n) => ({ name: n })), rows, total: rows.length, affectedRows: 0 },
        ],
        ms: 0,
      });
    },
  };
  return { rt, sent };
}

describe("fetchRows", () => {
  it("識別子の二重引用符をエスケープする", async () => {
    const { rt, sent } = stub();
    await fetchRows(rt, name('a"b'), 20);
    expect(sent[0]).toBe('select * from "a""b" limit 20');
  });

  it("識別子に $ が含まれても SQL が壊れない", async () => {
    const { rt, sent } = stub();
    await fetchRows(rt, name("x$'y"), 20);
    expect(sent[0]).toBe('select * from "x$\'y" limit 20');
  });

  it.each([
    [0, 1],
    [-5, 1],
    [20.7, 20],
    [99999, 1000],
    [Number.NaN, 1],
  ])("limit %s を %s に丸める", async (given, want) => {
    const { rt, sent } = stub();
    await fetchRows(rt, name("t"), given);
    expect(sent[0]).toBe(`select * from "t" limit ${want}`);
  });
});

describe("fetchTables", () => {
  it("ANALYZE 前の -1 をそのまま返す", async () => {
    const { rt } = stub([["orders", -1]]);
    await expect(fetchTables(rt)).resolves.toStrictEqual([{ name: "orders", rows: -1 }]);
  });

  it("欠けたセルを空名と 0 行にする", async () => {
    const { rt } = stub([[undefined, undefined]]);
    await expect(fetchTables(rt)).resolves.toStrictEqual([{ name: "", rows: 0 }]);
  });
});

describe("fetchRelations", () => {
  it("外部キーの 4 つ組を写す", async () => {
    const { rt } = stub([["items_order_fk", "items", "orders", "FOREIGN KEY (order_id)"]]);
    await expect(fetchRelations(rt)).resolves.toStrictEqual([
      { name: "items_order_fk", src: "items", tgt: "orders", def: "FOREIGN KEY (order_id)" },
    ]);
  });

  it("欠けたセルを空文字にする", async () => {
    const { rt } = stub([[undefined, undefined, undefined, undefined]]);
    await expect(fetchRelations(rt)).resolves.toStrictEqual([
      { name: "", src: "", tgt: "", def: "" },
    ]);
  });
});

describe("結果が空のとき", () => {
  it("fetchTables は空配列を返す", async () => {
    const rt = {
      version: "",
      replayFailed: [],
      exec: () => Promise.resolve({ results: [], ms: 0 }),
    };
    await expect(fetchTables(rt)).resolves.toStrictEqual([]);
  });

  it("fetchRows は列も行も空で返す", async () => {
    const rt = {
      version: "",
      replayFailed: [],
      exec: () => Promise.resolve({ results: [], ms: 0 }),
    };
    await expect(fetchRows(rt, name("t"), 20)).resolves.toStrictEqual({ head: [], rows: [] });
  });
});

describe("fetchColumnsByTable", () => {
  it("同じテーブルの 2 列目以降を既存の配列へ足す", async () => {
    const { rt } = stub([
      ["orders", "id", "integer", false, true],
      ["orders", "note", "text", true, false],
    ]);
    const got = await fetchColumnsByTable(rt);
    expect(got.get("orders")?.map((c) => c.name)).toStrictEqual(["id", "note"]);
  });

  it("欠けたテーブル名を空文字の鍵にする", async () => {
    const { rt } = stub([[undefined, "id", "integer", false, true]]);
    const got = await fetchColumnsByTable(rt);
    expect([...got.keys()]).toStrictEqual([""]);
  });

  it("テーブル名ごとに束ねる", async () => {
    const { rt } = stub([
      ["orders", "id", "integer", false, true],
      ["orders", "note", "text", true, false],
      ["items", "id", "integer", false, true],
    ]);
    const got = await fetchColumnsByTable(rt);
    expect([...got.keys()]).toStrictEqual(["orders", "items"]);
  });

  it("列の属性を写す", async () => {
    const { rt } = stub([["orders", "note", "text", true, false]]);
    const got = await fetchColumnsByTable(rt);
    expect(got.get("orders")).toStrictEqual([
      { name: "note", type: "text", nullable: true, pk: false },
    ]);
  });

  it("nullable と pk は true 以外を false にする", async () => {
    const { rt } = stub([["orders", "id", "integer", undefined, undefined]]);
    const got = await fetchColumnsByTable(rt);
    expect(got.get("orders")).toStrictEqual([
      { name: "id", type: "integer", nullable: false, pk: false },
    ]);
  });
});
