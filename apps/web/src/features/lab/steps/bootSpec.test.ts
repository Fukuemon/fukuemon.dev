import { afterEach, describe, expect, it, vi } from "vitest";
import { bootSpecId, encodeBootSpec, readBootSpec } from "./bootSpec";

/** `document.getElementById` の代役。実物はテスト環境に無い */
function stubDocument(text?: string) {
  vi.stubGlobal("document", {
    getElementById: (id: string) =>
      id === bootSpecId("a") && text !== undefined ? { textContent: text } : null,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeBootSpec", () => {
  it("< を退避して </script> で切れないようにする", () => {
    const got = encodeBootSpec({ steps: [{ step: 0, sql: "select 1 where x < 2;" }] });
    expect(got).not.toContain("<");
  });

  it("JSON としての意味は変えない", () => {
    const spec = { setup: "create table t (i int);", steps: [{ step: 0, sql: "a < b" }] };
    expect(JSON.parse(encodeBootSpec(spec))).toStrictEqual(spec);
  });
});

describe("readBootSpec", () => {
  it("置いた値を読む", () => {
    stubDocument(encodeBootSpec({ setup: "s", steps: [{ step: 0, sql: "q" }] }));
    expect(readBootSpec("a")).toStrictEqual({ setup: "s", steps: [{ step: 0, sql: "q" }] });
  });

  it("要素が無ければ空", () => {
    stubDocument();
    expect(readBootSpec("a")).toStrictEqual({ steps: [] });
  });

  it("document が無くても落ちない", () => {
    vi.stubGlobal("document", undefined);
    expect(readBootSpec("a")).toStrictEqual({ steps: [] });
  });

  it.each([
    ["壊れた JSON", "{"],
    ["配列", "[]"],
    ["null", "null"],
    ["steps 無し", "{}"],
    ["空文字", ""],
  ])("%s は空として扱う", (_name, raw) => {
    stubDocument(raw);
    expect(readBootSpec("a")).toStrictEqual({ steps: [] });
  });

  it("setup が文字列でなければ落とす", () => {
    stubDocument(JSON.stringify({ setup: 3, steps: [] }));
    expect(readBootSpec("a")).toStrictEqual({ setup: undefined, steps: [] });
  });
});
