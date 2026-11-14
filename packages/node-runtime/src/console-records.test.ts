import { describe, expect, it } from "vitest";

import {
  PREVIEW_CONSOLE_MESSAGE,
  createConsoleRecords,
  parseConsoleLine,
  parseConsoleRecord,
} from "./console-records";

const record = (args: unknown[], extra: Record<string, unknown> = {}) => ({
  level: "log",
  time: 1,
  args,
  ...extra,
});

/** schedule に渡された関数を、テストから呼ぶ。 */
function manualFrames() {
  const queued: (() => void)[] = [];
  return {
    schedule: (run: () => void) => {
      queued.push(run);
      return () => queued.splice(queued.indexOf(run), 1);
    },
    run: () => {
      for (const run of queued.splice(0)) run();
    },
    queued,
  };
}

describe("parseConsoleRecord", () => {
  it.each([
    ["文字列", { kind: "string", value: "a" }],
    ["text", { kind: "text", value: "<div>" }],
    ["bigint", { kind: "bigint", value: "1" }],
    ["真偽値", { kind: "boolean", value: false }],
    ["null", { kind: "null" }],
    ["undefined", { kind: "undefined" }],
    ["循環", { kind: "circular" }],
    ["symbol", { kind: "symbol", description: "s" }],
    ["関数", { kind: "function", name: "f" }],
    ["Set", { kind: "set", items: [{ kind: "null" }] }],
    ["クラスのインスタンス", { kind: "object", className: "Point", entries: [] }],
    [
      "Map",
      {
        kind: "map",
        entries: [{ key: { kind: "string", value: "k" }, value: { kind: "null" } }],
      },
    ],
    ["stack の無い Error", { kind: "error", name: "Error", message: "m" }],
    ["stack のある Error", { kind: "error", name: "Error", message: "m", stack: ["at f"] }],
  ])("%sを読む", (_, value) => {
    expect(parseConsoleRecord(record([value]))?.args).toStrictEqual([value]);
  });

  it.each([
    ["NaN", Number.NaN],
    ["-0", -0],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["1.5", 1.5],
  ])("文字で運んだ数 %s を数にする", (text, value) => {
    expect(parseConsoleRecord(record([{ kind: "number", value: text }]))?.args).toStrictEqual([
      { kind: "number", value },
    ]);
  });

  it.each([
    ["オブジェクトでない", "x"],
    ["ログレベルが知らないもの", record([], { level: "trace" })],
    ["時刻が数でない", record([], { time: "1" })],
    ["時刻が有限でない", record([], { time: Number.POSITIVE_INFINITY })],
    ["引数が配列でない", record([], { args: {} })],
    ["引数が多すぎる", record(Array.from({ length: 101 }, () => ({ kind: "null" })))],
    ["値の種類が知らないもの", record([{ kind: "date" }])],
    ["値がオブジェクトでない", record([1])],
    ["数が数として読めない", record([{ kind: "number", value: "one" }])],
    ["真偽値が真偽値でない", record([{ kind: "boolean", value: "true" }])],
    ["文字列が長すぎる", record([{ kind: "string", value: "x".repeat(10_002) }])],
    ["配列の items が配列でない", record([{ kind: "array", items: {} }])],
    ["オブジェクトの項目が配列でない", record([{ kind: "object", entries: {} }])],
    ["オブジェクトの項目がオブジェクトでない", record([{ kind: "object", entries: [1] }])],
    ["Map の項目が配列でない", record([{ kind: "map", entries: {} }])],
    ["Map の項目がオブジェクトでない", record([{ kind: "map", entries: [1] }])],
    [
      "stack が長すぎる",
      record([{ kind: "error", name: "E", message: "", stack: Array(31).fill("at") }]),
    ],
    ["stack が配列でない", record([{ kind: "error", name: "E", message: "", stack: "at" }])],
  ])("%sときは、記録を捨てる", (_, value) => {
    expect(parseConsoleRecord(value)).toBeUndefined();
  });

  it("深すぎる入れ子は、記録を捨てる", () => {
    let value: unknown = { kind: "null" };
    for (let depth = 0; depth < 10; depth += 1) value = { kind: "array", items: [value] };
    expect(parseConsoleRecord(record([value]))).toBeUndefined();
  });

  it("値の数が上限を超えたら、記録を捨てる", () => {
    const items = Array.from({ length: 2100 }, () => ({ kind: "null" }));
    expect(parseConsoleRecord(record([{ kind: "array", items }]))).toBeUndefined();
  });
});

describe("parseConsoleLine", () => {
  it("JSON として読めない行は捨てる", () => {
    expect(parseConsoleLine("{")).toBeUndefined();
  });

  it("記録の行を読む", () => {
    expect(parseConsoleLine(JSON.stringify(record([{ kind: "null" }])))).toStrictEqual({
      level: "log",
      time: 1,
      args: [{ kind: "null" }],
    });
  });
});

describe("createConsoleRecords", () => {
  const line = (value: string) => JSON.stringify(record([{ kind: "string", value }]));

  it("届いた記録を、描画の 1 回分ずつまとめて store に入れる", () => {
    const frames = manualFrames();
    const records = createConsoleRecords({ schedule: frames.schedule });
    let notified = 0;
    records.store.subscribe(() => (notified += 1));
    records.acceptLine(line("a"), { name: "サーバー" });
    records.acceptLine(line("b"), { name: "サーバー" });
    expect(records.store.getSnapshot()).toStrictEqual([]);
    expect(frames.queued).toHaveLength(1);
    frames.run();
    expect(notified).toBe(1);
    expect(records.store.getSnapshot()).toStrictEqual([
      {
        id: "1",
        source: { kind: "process", name: "サーバー" },
        level: "log",
        time: 1,
        args: [{ kind: "string", value: "a" }],
      },
      {
        id: "2",
        source: { kind: "process", name: "サーバー" },
        level: "log",
        time: 1,
        args: [{ kind: "string", value: "b" }],
      },
    ]);
  });

  it("上限を超えたら、古いものから捨てる", () => {
    const frames = manualFrames();
    const records = createConsoleRecords({ max: 2, schedule: frames.schedule });
    records.acceptLine(line("a"), { name: "p" });
    frames.run();
    for (const value of ["b", "c", "d"]) records.acceptLine(line(value), { name: "p" });
    frames.run();
    expect(records.store.getSnapshot().map((item) => item.id)).toStrictEqual(["3", "4"]);
  });

  it("形に合わない行は、store に入れない", () => {
    const frames = manualFrames();
    const records = createConsoleRecords({ schedule: frames.schedule });
    records.acceptLine("{", { name: "p" });
    expect(frames.queued).toHaveLength(0);
  });

  it("プレビューのメッセージを、ポートを出力元にして入れる", () => {
    const frames = manualFrames();
    const records = createConsoleRecords({ schedule: frames.schedule });
    records.acceptPreviewMessage({ type: PREVIEW_CONSOLE_MESSAGE, ...record([]) }, 3000);
    frames.run();
    expect(records.store.getSnapshot()[0]?.source).toStrictEqual({ kind: "preview", port: 3000 });
  });

  it.each([
    ["type の違うメッセージ", { type: "other", ...record([]) }],
    ["オブジェクトでないメッセージ", "x"],
  ])("%sは入れない", (_, message) => {
    const frames = manualFrames();
    const records = createConsoleRecords({ schedule: frames.schedule });
    records.acceptPreviewMessage(message, 3000);
    expect(frames.queued).toHaveLength(0);
  });

  it("dispose の後は、まとめていた記録を入れず、新しい記録も受けない", () => {
    const frames = manualFrames();
    const records = createConsoleRecords({ schedule: frames.schedule });
    records.acceptLine(line("a"), { name: "p" });
    records.dispose();
    records.acceptLine(line("b"), { name: "p" });
    frames.run();
    expect(records.store.getSnapshot()).toStrictEqual([]);
  });

  it("schedule を渡さないときは、次の描画の前に入れる", async () => {
    const records = createConsoleRecords();
    records.acceptLine(line("a"), { name: "p" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(records.store.getSnapshot()).toHaveLength(1);
  });
});
