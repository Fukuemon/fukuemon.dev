import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BackendProcess } from "./backend";
import {
  HTTP_PREFIX,
  createHttpRecords,
  createRecordLineFilter,
  parseHttpLine,
  withoutRecordLines,
} from "./http-records";

/** 抜き出す処理に chunks を順に渡し、端末に渡した出力と記録の行を返す。 */
const filtered = (...chunks: string[]) => {
  const text: string[] = [];
  const lines: string[] = [];
  const filter = createRecordLineFilter(
    (chunk) => text.push(chunk),
    (line) => lines.push(line),
  );
  for (const chunk of chunks) filter.push(chunk);
  return { filter, text, lines };
};

describe("createRecordLineFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("記録の行を除いた出力を端末に渡す", () => {
    const { text } = filtered(`listening\r\n${HTTP_PREFIX}{"a":1}\r\nnext\r\n`);
    expect(text.join("")).toBe("listening\r\nnext\r\n");
  });

  it("記録の行の中身を、端末の改行の \\r を外して渡す", () => {
    const { lines } = filtered(`listening\r\n${HTTP_PREFIX}{"a":1}\r\nnext\r\n`);
    expect(lines).toStrictEqual(['{"a":1}']);
  });

  it("行の途中で切れた記録の行は、改行が届くまで端末に渡さない", () => {
    const { text } = filtered(`ok ${HTTP_PREFIX}{"a"`);
    vi.advanceTimersByTime(1000);
    expect(text.join("")).toBe("ok ");
  });

  it("行の途中で切れた記録の行は、続きが届いたら 1 行にする", () => {
    const { lines } = filtered(`ok ${HTTP_PREFIX}{"a"`, ":2}\nafter");
    expect(lines).toStrictEqual(['{"a":2}']);
  });

  it("頭の途中で切れた出力は、続きが届いたら記録の行にする", () => {
    const { lines } = filtered("prompt $ @@fd", ":http {}\n");
    expect(lines).toStrictEqual(["{}"]);
  });

  it("頭の途中で切れた出力は、続きが来なければ 50 ms の後に端末に渡す", () => {
    const { text } = filtered("user typed @");
    vi.advanceTimersByTime(50);
    expect(text).toStrictEqual(["user typed ", "@"]);
  });

  it("flush は、手元の出力を端末に渡す", () => {
    const { filter, text } = filtered(`${HTTP_PREFIX}{"cut"`);
    filter.flush();
    expect(text).toStrictEqual([`${HTTP_PREFIX}{"cut"`]);
  });

  it("discard は、手元の出力を捨て、50 ms の後にも渡さない", () => {
    const { filter, text } = filtered("user typed @");
    filter.discard();
    vi.advanceTimersByTime(50);
    expect(text).toStrictEqual(["user typed "]);
  });

  it("改行の無いまま上限を超えた行は、記録の行とみなさず端末に出す", () => {
    const long = "x".repeat(4 * 1024 * 1024 + 1);
    const { text } = filtered(`${HTTP_PREFIX}${long}`);
    expect(text.join("")).toBe(`${HTTP_PREFIX}${long}`);
  });
});

/** テストから出力を流し、終わらせるプロセス。 */
function fakeProcess() {
  const listeners = new Set<(chunk: string) => void>();
  let finish: (code: number) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const exit = new Promise<number>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const process: BackendProcess = {
    output: {
      subscribe: (onChunk) => {
        listeners.add(onChunk);
        return () => listeners.delete(onChunk);
      },
    },
    write: () => undefined,
    resize: () => undefined,
    kill: () => undefined,
    exit,
  };
  const emit = (chunk: string) => {
    for (const listener of listeners) listener(chunk);
  };
  return { process, emit, finish, fail, listeners };
}

describe("withoutRecordLines", () => {
  it.each([
    ["終了コードで終わった", (p: ReturnType<typeof fakeProcess>) => p.finish(0)],
    ["exit が失敗した", (p: ReturnType<typeof fakeProcess>) => p.fail(new Error("x"))],
  ])("プロセスが%sときは、手元の出力を購読した側に渡す", async (_, end) => {
    const fake = fakeProcess();
    const chunks: string[] = [];
    withoutRecordLines(fake.process, () => undefined).output.subscribe((c) => chunks.push(c));
    fake.emit(`${HTTP_PREFIX}{`);
    end(fake);
    await fake.process.exit.catch(() => undefined);
    expect(chunks).toStrictEqual([`${HTTP_PREFIX}{`]);
  });

  it("購読を外した後は、プロセスが終わっても、手元の出力を渡さない", async () => {
    const fake = fakeProcess();
    const chunks: string[] = [];
    const stop = withoutRecordLines(fake.process, () => undefined).output.subscribe((c) =>
      chunks.push(c),
    );
    fake.emit(`${HTTP_PREFIX}{`);
    stop();
    fake.finish(0);
    await fake.process.exit;
    expect(chunks).toStrictEqual([]);
  });
});

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
    ["状態コードが整数でない", exchange({ response: { status: 1e999, headers: [] } })],
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
