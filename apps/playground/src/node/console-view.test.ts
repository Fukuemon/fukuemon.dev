import type { ConsoleRecord } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import { consoleTabLabel, formatTime, sourceName, toEntry } from "./console-view";

const record: ConsoleRecord = {
  id: "1",
  level: "warn",
  source: { kind: "process", name: "サーバー" },
  time: new Date(2026, 10, 14, 9, 5, 7, 42).getTime(),
  args: [{ kind: "string", value: "遅い" }],
};

describe("toEntry", () => {
  it("記録を、出力元の名前と時刻の文字を持つ行にする", () => {
    expect(toEntry(record)).toStrictEqual({
      id: "1",
      level: "warn",
      source: "サーバー",
      time: "09:05:07.042",
      args: [{ kind: "string", value: "遅い" }],
    });
  });

  it("同じ記録には、同じ行を返す", () => {
    expect(toEntry(record)).toBe(toEntry(record));
  });
});

describe("sourceName", () => {
  it("プレビューは、ページを返したサーバーのポートで呼ぶ", () => {
    expect(sourceName({ kind: "preview", port: 3000 })).toBe("3000 番のプレビュー");
  });
});

describe("formatTime", () => {
  it("2 桁と 3 桁にそろえる", () => {
    expect(formatTime(new Date(2026, 0, 1, 23, 59, 0, 5).getTime())).toBe("23:59:00.005");
  });
});

describe("consoleTabLabel", () => {
  it("記録が無いときは、件数を添えない", () => {
    expect(consoleTabLabel(0)).toBe("コンソール");
  });

  it("記録があるときは、件数を添える", () => {
    expect(consoleTabLabel(3)).toBe("コンソール（3）");
  });
});
