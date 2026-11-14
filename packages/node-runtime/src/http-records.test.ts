import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_PREFIX,
  createHttpRecords,
  createRecordLineFilter,
  parseHttpLine,
} from "./http-records";

const filter = () => {
  const text: string[] = [];
  const lines: string[] = [];
  const created = createRecordLineFilter(
    (chunk) => text.push(chunk),
    (line) => lines.push(line),
  );
  return { ...created, text: () => text.join(""), lines };
};

describe("createRecordLineFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("記録の行を抜き出し、ほかの出力を端末に渡す。端末の改行の \\r も外す", () => {
    const f = filter();
    f.push(`listening\r\n${HTTP_PREFIX}{"a":1}\r\nnext\r\n`);
    expect(f.lines).toEqual(['{"a":1}']);
    expect(f.text()).toBe("listening\r\nnext\r\n");
  });

  it("行の途中で切れた記録の行は、改行が届くまで待って 1 行にする", () => {
    const f = filter();
    f.push(`ok ${HTTP_PREFIX}{"a"`);
    expect(f.text()).toBe("ok ");
    vi.advanceTimersByTime(1000);
    expect(f.text()).toBe("ok ");
    f.push(":2}\nafter");
    expect(f.lines).toEqual(['{"a":2}']);
    expect(f.text()).toBe("ok after");
  });

  it("頭の途中で切れたときは、続きを待ち、続きが来なければ端末に出す", () => {
    const f = filter();
    f.push("prompt $ @@fd");
    expect(f.text()).toBe("prompt $ ");
    f.push(":http {}\n");
    expect(f.lines).toEqual(["{}"]);

    f.push("user typed @");
    expect(f.text()).toBe("prompt $ user typed ");
    vi.advanceTimersByTime(50);
    expect(f.text()).toBe("prompt $ user typed @");
  });

  it("プロセスが終わったときは、手元の出力を端末に出す", () => {
    const f = filter();
    f.push(`${HTTP_PREFIX}{"cut"`);
    f.flush();
    expect(f.lines).toEqual([]);
    expect(f.text()).toBe(`${HTTP_PREFIX}{"cut"`);
  });

  it("改行の無いまま上限を超えた行は、記録の行とみなさず端末に出す", () => {
    const f = filter();
    const long = "x".repeat(4 * 1024 * 1024 + 1);
    f.push(`${HTTP_PREFIX}${long}`);
    expect(f.text()).toBe(`${HTTP_PREFIX}${long}`);
  });
});

const exchange = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "exchange",
    id: 1,
    pid: 10,
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
    ["ヘッダの形が違う", exchange({ request: { headers: [["a", "b"]] } })],
    ["本文の形が違う", exchange({ request: { headers: [], body: { text: 1 } } })],
    ["状態コードが無い", exchange({ response: { headers: [] } })],
    ["送信元が数", exchange({ from: 3000 })],
  ])("%s行は捨てる", (_, line) => {
    expect(parseHttpLine(line)).toBeUndefined();
  });

  it("レスポンスが無い行は、response を持たない", () => {
    const parsed = parseHttpLine(exchange({ response: null }));
    expect(parsed).toMatchObject({ type: "exchange", record: { url: "/login" } });
    expect(parsed?.type === "exchange" && "response" in parsed.record).toBe(false);
  });
});

describe("createHttpRecords", () => {
  const command = { kind: "command", name: "クライアント" } as const;
  const auth = { kind: "command", name: "認可サーバー" } as const;

  it("受けたサーバーと送ったサーバーを、待ち受けた行を出したプロセスの名前で呼ぶ", () => {
    const records = createHttpRecords();
    records.accept('{"type":"listen","port":3000}', command);
    records.accept('{"type":"listen","port":4000}', auth);
    records.accept(exchange(), command);
    records.accept(exchange({ from: "3000", to: 4000, url: "/token", startedAt: 120 }), auth);
    expect(records.store.getSnapshot()).toMatchObject([
      {
        id: "1",
        from: { id: "browser", name: "ブラウザ" },
        to: { id: "port:3000", name: "クライアント" },
      },
      {
        id: "2",
        from: { id: "port:3000", name: "クライアント" },
        to: { id: "port:4000", name: "認可サーバー" },
        request: { headers: [{ name: "host", value: "localhost" }] },
      },
    ]);
  });

  it("後から届いた記録も、リクエストを受けた時刻の順に並べる", () => {
    const records = createHttpRecords();
    records.accept(exchange({ url: "/token", startedAt: 150 }), auth);
    records.accept(exchange({ url: "/callback", startedAt: 140 }), command);
    records.accept(exchange({ url: "/", startedAt: 200 }), command);
    records.accept(exchange({ url: "/same", startedAt: 200 }), command);
    expect(records.store.getSnapshot().map((r) => r.url)).toEqual([
      "/callback",
      "/token",
      "/",
      "/same",
    ]);
  });

  it("待ち受けた行より先に届いた記録は、ポートの番号で呼び、待ち受けた行が届いたら名前を直す", () => {
    const records = createHttpRecords();
    records.accept(exchange({ from: "3000", to: 4000 }), auth);
    expect(records.store.getSnapshot()[0]?.from.name).toBe("3000 番のサーバー");
    records.accept('{"type":"listen","port":3000}', command);
    expect(records.store.getSnapshot()[0]?.from.name).toBe("クライアント");
  });

  it("シェルで起動したサーバーは、ポートの番号で呼ぶ", () => {
    const records = createHttpRecords();
    records.accept('{"type":"listen","port":5000}', { kind: "shell", name: "シェル" });
    records.accept(exchange({ to: 5000 }), { kind: "shell", name: "シェル" });
    expect(records.store.getSnapshot()[0]?.to.name).toBe("5000 番のサーバー");
  });

  it("待ち受けていないプロセスと、訪問者が付けたヘッダの値を、送信元にする", () => {
    const records = createHttpRecords();
    records.accept(exchange({ from: "pid-42" }), command);
    records.accept(exchange({ from: "mine", startedAt: 101 }), command);
    expect(records.store.getSnapshot().map((r) => r.from)).toEqual([
      { id: "pid:42", name: "Node のプロセス" },
      { id: "header:mine", name: "mine" },
    ]);
  });

  it("上限を超えたら、古い記録から捨てる。形に合わない行は数えない", () => {
    const records = createHttpRecords(2);
    records.accept("{", command);
    for (const startedAt of [1, 2, 3]) records.accept(exchange({ startedAt }), command);
    expect(records.store.getSnapshot().map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("名前が変わらない待ち受けた行では、store を変えない", () => {
    const records = createHttpRecords();
    records.accept('{"type":"listen","port":3000}', command);
    records.accept(exchange(), command);
    const before = records.store.getSnapshot();
    records.accept('{"type":"listen","port":3000}', command);
    records.accept('{"type":"listen","port":9999}', auth);
    expect(records.store.getSnapshot()).toBe(before);
  });
});
