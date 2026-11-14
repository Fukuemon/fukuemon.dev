import type { HttpRecord } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import { actorsOf, bodyText, toExchange } from "./http-view";

const record = (overrides: Partial<HttpRecord>): HttpRecord => ({
  id: "1",
  from: { id: "browser", name: "ブラウザ" },
  to: { id: "port:3000", name: "クライアント" },
  method: "GET",
  url: "/login",
  startedAt: 1,
  durationMs: 2,
  request: { headers: [{ name: "cookie", value: "state=a" }] },
  ...overrides,
});

describe("actorsOf", () => {
  it("通信した側を、ブラウザを先に、記録に初めて出た順に並べる", () => {
    const actors = actorsOf([
      record({
        id: "1",
        from: { id: "port:3000", name: "クライアント" },
        to: { id: "port:4000", name: "認可サーバー" },
      }),
      record({ id: "2" }),
    ]);
    expect(actors).toStrictEqual([
      { id: "browser", name: "ブラウザ" },
      { id: "port:3000", name: "クライアント" },
      { id: "port:4000", name: "認可サーバー" },
    ]);
  });
});

describe("toExchange", () => {
  it("レスポンスのある記録は、状態コードとレスポンスを持ち、無い記録は持たない", () => {
    const exchanges = [
      record({
        id: "1",
        response: {
          status: 302,
          headers: [{ name: "location", value: "/next" }],
          body: { text: "moved", size: 5, truncated: false },
        },
      }),
      record({ id: "2" }),
    ].map(toExchange);
    expect(exchanges).toStrictEqual([
      {
        id: "1",
        fromId: "browser",
        toId: "port:3000",
        method: "GET",
        url: "/login",
        status: 302,
        request: { headers: [{ name: "cookie", value: "state=a" }] },
        response: { headers: [{ name: "location", value: "/next" }], body: "moved" },
      },
      {
        id: "2",
        fromId: "browser",
        toId: "port:3000",
        method: "GET",
        url: "/login",
        request: { headers: [{ name: "cookie", value: "state=a" }] },
      },
    ]);
  });
});

describe("bodyText", () => {
  it.each([
    ["テキストの本文は、そのまま", { text: "ok", size: 2, truncated: false }, "ok"],
    [
      "テキストでない本文は、大きさ",
      { text: null, size: 2048, truncated: false },
      "（テキストでない本文、2 KB）",
    ],
    [
      "上限で切った本文は、全体の大きさを添える",
      { text: "abc", size: 70000, truncated: true },
      "abc\n…（先頭だけを記録しました。全体は 68.4 KB）",
    ],
    [
      "1 KB に満たない大きさは、バイトで書く",
      { text: null, size: 3, truncated: false },
      "（テキストでない本文、3 バイト）",
    ],
  ])("%s", (_, body, expected) => {
    expect(bodyText(body)).toBe(expected);
  });
});
