import { describe, expect, it } from "vitest";

import { createHttpRecords, parseHttpLine } from "./http-records";

const exchange = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "exchange",
    from: null,
    to: 3000,
    startedAt: 100,
    durationMs: 5,
    method: "GET",
    url: "/login",
    request: { headers: [{ name: "host", value: "localhost" }] },
    response: {
      status: 302,
      headers: [{ name: "location", value: "/next" }],
      body: { text: "moved", size: 5, truncated: false },
    },
    ...overrides,
  });

describe("parseHttpLine", () => {
  it.each([
    ["JSON でない", "{"],
    ["種類が無い", "{}"],
    ["ポートが数でない", '{"type":"listen","port":"3000"}'],
    ["ポートが整数でない", '{"type":"listen","port":3000.5}'],
    ["受けたポートが範囲の外", exchange({ to: 70000 })],
    ["状態コードが整数でない", exchange({ response: { status: 302.5, headers: [] } })],
    ["ヘッダの形が違う", exchange({ request: { headers: [["a", "b"]] } })],
    ["本文の形が違う", exchange({ request: { headers: [], body: { text: 1 } } })],
    ["状態コードが無い", exchange({ response: { headers: [] } })],
    ["レスポンスがオブジェクトでない", exchange({ response: "x" })],
    ["送信元が数", exchange({ from: 3000 })],
  ])("%s行は捨てる", (_, line) => {
    expect(parseHttpLine(line)).toBeUndefined();
  });

  it("レスポンスが null の行は、response を持たない", () => {
    expect(parseHttpLine(exchange({ response: null }))).toStrictEqual({
      type: "exchange",
      from: null,
      to: 3000,
      record: {
        method: "GET",
        url: "/login",
        startedAt: 100,
        durationMs: 5,
        request: { headers: [{ name: "host", value: "localhost" }] },
      },
    });
  });
});

const client = { kind: "command", name: "クライアント" } as const;
const auth = { kind: "command", name: "認可サーバー" } as const;
const listen = (port: number) => `{"type":"listen","port":${port}}`;

/** 記録の store に lines を順に渡し、記録の一覧を返す。 */
const accepted = (...lines: [string, { kind: "command" | "shell"; name: string }][]) => {
  const records = createHttpRecords();
  for (const [line, source] of lines) records.accept(line, source);
  return records.store.getSnapshot();
};

describe("createHttpRecords", () => {
  it("受けたサーバーと送ったサーバーを、待ち受けた行を出したプロセスの名前で呼ぶ", () => {
    const records = accepted(
      [listen(3000), client],
      [listen(4000), auth],
      [exchange(), client],
      [exchange({ from: "3000", to: 4000, url: "/token", startedAt: 120, response: null }), auth],
    );
    expect(records).toStrictEqual([
      {
        id: "1",
        from: { id: "browser", name: "ブラウザ" },
        to: { id: "port:3000", name: "クライアント" },
        method: "GET",
        url: "/login",
        startedAt: 100,
        durationMs: 5,
        request: { headers: [{ name: "host", value: "localhost" }] },
        response: {
          status: 302,
          headers: [{ name: "location", value: "/next" }],
          body: { text: "moved", size: 5, truncated: false },
        },
      },
      {
        id: "2",
        from: { id: "port:3000", name: "クライアント" },
        to: { id: "port:4000", name: "認可サーバー" },
        method: "GET",
        url: "/token",
        startedAt: 120,
        durationMs: 5,
        request: { headers: [{ name: "host", value: "localhost" }] },
      },
    ]);
  });

  it("後から届いた記録も、リクエストを受けた時刻の順に並べ、同じ時刻は届いた順にする", () => {
    const records = accepted(
      [exchange({ url: "/token", startedAt: 150.5 }), auth],
      [exchange({ url: "/callback", startedAt: 150.25 }), client],
      [exchange({ url: "/", startedAt: 200 }), client],
      [exchange({ url: "/same", startedAt: 200 }), client],
    );
    expect(records.map((r) => r.url)).toStrictEqual(["/callback", "/token", "/", "/same"]);
  });

  it("待ち受けた行より先に届いた記録は、ポートの番号で呼ぶ", () => {
    const records = accepted([exchange({ from: "3000", to: 4000 }), auth]);
    expect(records.map((r) => r.from.name)).toStrictEqual(["3000 番のサーバー"]);
  });

  it("待ち受けた行が後から届いたら、記録の名前を直す", () => {
    const records = accepted([exchange({ from: "3000", to: 4000 }), auth], [listen(3000), client]);
    expect(records.map((r) => r.from.name)).toStrictEqual(["クライアント"]);
  });

  it("シェルで起動したサーバーは、ポートの番号で呼ぶ", () => {
    const shell = { kind: "shell", name: "シェル" } as const;
    const records = accepted([listen(5000), shell], [exchange({ to: 5000 }), shell]);
    expect(records.map((r) => r.to.name)).toStrictEqual(["5000 番のサーバー"]);
  });

  it("待ち受けていないプロセスはまとめて 1 つの側にし、訪問者が付けたヘッダの値はそのまま側にする", () => {
    const records = accepted(
      [exchange({ from: "pid-42" }), client],
      [exchange({ from: "pid-43", startedAt: 101 }), client],
      [exchange({ from: "mine", startedAt: 102 }), client],
    );
    expect(records.map((r) => r.from)).toStrictEqual([
      { id: "process", name: "Node のプロセス" },
      { id: "process", name: "Node のプロセス" },
      { id: "header:mine", name: "mine" },
    ]);
  });

  it("上限を超えたら、古い記録から捨てる。形に合わない行は数えない", () => {
    const records = createHttpRecords(2);
    records.accept("{", client);
    for (const startedAt of [1, 2, 3]) records.accept(exchange({ startedAt }), client);
    expect(records.store.getSnapshot().map((r) => r.id)).toStrictEqual(["2", "3"]);
  });

  it("名前が変わらない待ち受けた行では、store を変えない", () => {
    const records = createHttpRecords();
    records.accept(listen(3000), client);
    records.accept(exchange(), client);
    const before = records.store.getSnapshot();
    records.accept(listen(3000), client);
    records.accept(listen(9999), auth);
    expect(records.store.getSnapshot()).toBe(before);
  });
});

describe("偽の記録の行の上限", () => {
  const parsedRecord = (overrides: Record<string, unknown>) => {
    const parsed = parseHttpLine(exchange(overrides));
    return parsed?.type === "exchange" ? parsed.record : undefined;
  };

  it("64 KB の文字を超えた本文は切り、truncated を立てる", () => {
    const text = "a".repeat(64 * 1024 + 10);
    const body = parsedRecord({
      request: { headers: [], body: { text, size: 1, truncated: false } },
    })?.request.body;
    expect(body).toStrictEqual({
      text: text.slice(0, 64 * 1024),
      size: text.length,
      truncated: true,
    });
  });

  it("100 個を超えたヘッダは捨て、捨てた数を持つ", () => {
    const headers = Array.from({ length: 103 }, (_, i) => ({ name: `h${i}`, value: "v" }));
    const request = parsedRecord({ request: { headers } })?.request;
    expect([request?.headers.length, request?.omittedHeaders]).toStrictEqual([100, 3]);
  });

  it("8 KB の文字を超えた URL は切り、urlTruncated を立てる", () => {
    const record = parsedRecord({ url: `/${"a".repeat(9000)}` });
    expect([record?.url.length, record?.urlTruncated]).toStrictEqual([8 * 1024, true]);
  });

  it("上限の中の行には、切ったことを示す値を付けない", () => {
    const record = parsedRecord({});
    expect([record?.urlTruncated, record?.request.omittedHeaders]).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("100 個を超えて待ち受けたサーバーの名前は覚えず、ポートの番号で呼ぶ", () => {
    const records = createHttpRecords();
    for (let port = 1; port <= 100; port += 1) records.accept(listen(port), auth);
    records.accept(listen(3000), client);
    records.accept(exchange(), client);
    expect(records.store.getSnapshot()[0]?.to.name).toBe("3000 番のサーバー");
  });
});
