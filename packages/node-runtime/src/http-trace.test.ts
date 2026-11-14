import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { HTTP_PREFIX } from "./record-lines";

const PRELOAD = fileURLToPath(new URL("./guest/http-trace.cjs", import.meta.url));

type Line = Record<string, unknown>;

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/**
 * preload を読み込んだ Node で script を動かし、標準出力の記録の行と、ほかの行を分けて返す。
 * before を渡すと、preload より先に読み込む。記録の行の時刻は、比べられるように消す。
 */
async function run(script: string, before?: string): Promise<{ records: Line[]; text: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), "http-trace-"));
  dirs.push(dir);
  const file = join(dir, "main.cjs");
  await writeFile(file, script);
  const requires = [`--require ${PRELOAD}`];
  if (before !== undefined) {
    await writeFile(join(dir, "before.cjs"), before);
    requires.unshift(`--require ${join(dir, "before.cjs")}`);
  }
  const { stdout } = await promisify(execFile)(process.execPath, [file], {
    env: { ...process.env, NODE_OPTIONS: requires.join(" ") },
    timeout: 10_000,
  });
  const lines = stdout.split("\n").filter(Boolean);
  return {
    records: lines
      .filter((l) => l.startsWith(HTTP_PREFIX))
      .map((l) => {
        const {
          startedAt: _,
          durationMs: __,
          ...rest
        } = JSON.parse(l.slice(HTTP_PREFIX.length)) as Line;
        return rest;
      }),
    text: lines.filter((l) => !l.startsWith(HTTP_PREFIX)),
  };
}

const exchanges = (records: Line[]) => records.filter((r) => r.type === "exchange");

const responseBody = (records: Line[]) =>
  (exchanges(records)[0]?.response as Line | undefined)?.body;

/** 1 つのサーバーを 3000 番で待ち受け、handler で応答し、client を流してから閉じる script。 */
const oneServer = (handler: string, client: string) => String.raw`
const http = require("node:http");
const server = http.createServer(${handler});
server.listen(3000, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:3000";
  ${client}
  server.close();
});
`;

// 認可サーバー（3001 番）とクライアント（3000 番）を 1 つのプロセスで待ち受け、クライアントが認可サーバーへ fetch する
const TWO_SERVERS = String.raw`
const http = require("node:http");
const listen = (server, port) => new Promise((r) => server.listen(port, "127.0.0.1", r));
(async () => {
  const auth = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c) => (body += c));
    req.on("end", () => res.end("got " + body));
  });
  await listen(auth, 3001);
  const client = http.createServer(async (req, res) => {
    const r = await fetch("http://localhost:3001/token", { method: "POST", body: "code=x" });
    res.end(await r.text());
  });
  await listen(client, 3000);
  console.log(await (await fetch("http://127.0.0.1:3000/callback")).text());
  auth.close();
  client.close();
})();
`;

const LOGIN = oneServer(
  String.raw`(req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(302, { location: "/next", "set-cookie": ["state=a; HttpOnly", "other=b"] });
      res.end("moved");
    });
  }`,
  String.raw`await fetch(base + "/login", { method: "POST", body: "a=1", redirect: "manual", headers: { "x-playground-from": "mine", accept: "text/plain" } });`,
);

describe("http-trace", () => {
  it("待ち受けたポートを、待ち受けた順に 1 行ずつ記録する", async () => {
    const { records } = await run(TWO_SERVERS);
    expect(records.filter((r) => r.type === "listen")).toStrictEqual([
      { type: "listen", port: 3001 },
      { type: "listen", port: 3000 },
    ]);
  });

  it("リクエストを処理している間の fetch は、そのリクエストを受けたサーバーのポートを送信元にする", async () => {
    const { records } = await run(TWO_SERVERS);
    expect(exchanges(records).map((r) => [r.url, r.from, r.to])).toStrictEqual([
      ["/token", "3000", 3001],
      ["/callback", "3001", 3000],
    ]);
  });

  it("訪問者の処理が受け取る本文を、渡したまま受け取れる", async () => {
    const { text } = await run(TWO_SERVERS);
    expect(text).toStrictEqual(["got code=x"]);
  });

  it("リクエストの、送信元のヘッダの値、メソッド、URL、本文を記録する", async () => {
    const { records } = await run(LOGIN);
    const { request, response: _, ...rest } = exchanges(records)[0] ?? {};
    expect({ ...rest, body: (request as Line).body }).toStrictEqual({
      type: "exchange",
      from: "mine",
      to: 3000,
      method: "POST",
      url: "/login",
      body: { text: "a=1", size: 3, truncated: false },
    });
  });

  it("訪問者が付けた送信元のヘッダを、書き換えずに送る", async () => {
    const { records } = await run(LOGIN);
    const headers =
      (exchanges(records)[0]?.request as { headers: Line[] } | undefined)?.headers ?? [];
    expect(
      headers.filter((h) => ["accept", "x-playground-from"].includes(String(h.name))),
    ).toStrictEqual([
      { name: "x-playground-from", value: "mine" },
      { name: "accept", value: "text/plain" },
    ]);
  });

  it("レスポンスのステータスコードと、writeHead に渡したヘッダと、本文を記録する", async () => {
    const { records } = await run(LOGIN);
    const response = exchanges(records)[0]?.response as { headers: Line[] };
    expect({
      ...response,
      headers: response.headers.filter((h) => h.name !== "Date"),
    }).toStrictEqual({
      status: 302,
      headers: [
        { name: "location", value: "/next" },
        { name: "set-cookie", value: "state=a; HttpOnly" },
        { name: "set-cookie", value: "other=b" },
        { name: "Connection", value: "keep-alive" },
        { name: "Keep-Alive", value: "timeout=5" },
        { name: "Transfer-Encoding", value: "chunked" },
      ],
      body: { text: "moved", size: 5, truncated: false },
    });
  });

  it("待ち受けていないプロセスの fetch は、プロセスの ID を送信元にする", async () => {
    const { records } = await run(
      oneServer(
        `(req, res) => res.end("ok")`,
        // 子のプロセスは、NODE_OPTIONS を受け継ぎ、preload を読む
        String.raw`await new Promise((r) => require("node:child_process").execFile(process.execPath, ["-e", "fetch('http://localhost:3000/')"], r));`,
      ),
    );
    expect(String(exchanges(records)[0]?.from)).toMatch(/^pid-\d+$/);
  });

  it("外のホストへの fetch には、送信元を示すヘッダを足さない", async () => {
    const { text } = await run(
      `fetch("https://example.invalid/", { headers: { a: "1" } }).then(() => {});`,
      // preload が包む前の fetch を差し替え、届いた引数を出す
      `globalThis.fetch = async (input, init) => { console.log(JSON.stringify([input, init])); return new Response(""); };`,
    );
    expect(text).toStrictEqual(['["https://example.invalid/",{"headers":{"a":"1"}}]']);
  });

  it("ヘッダを組めない fetch は、元の fetch に任せ、Promise の失敗で返す", async () => {
    const { text } = await run(
      `fetch("http://localhost:1/", { headers: { "bad name": "x" } }).catch((e) => console.log(e.name));`,
    );
    expect(text).toStrictEqual(["TypeError"]);
  });

  it("res.write で送った本文も記録する", async () => {
    const { records } = await run(
      oneServer(
        `(req, res) => { res.write("ab"); res.end(Buffer.from("cd")); }`,
        `await (await fetch(base)).text();`,
      ),
    );
    expect(responseBody(records)).toStrictEqual({ text: "abcd", size: 4, truncated: false });
  });

  it("本文は 64 KB で切り、途中で切れた文字は捨てる", async () => {
    const { records } = await run(
      oneServer(`(req, res) => res.end("あ".repeat(30000))`, `await (await fetch(base)).text();`),
    );
    expect(responseBody(records)).toStrictEqual({
      text: "あ".repeat(Math.floor((64 * 1024) / 3)),
      size: 90000,
      truncated: true,
    });
  });

  it("上限まで写した後に届いた本文も、大きさに数える", async () => {
    const { records } = await run(
      oneServer(
        `(req, res) => { res.write("a".repeat(70000)); res.end("あ"); }`,
        `await (await fetch(base)).text();`,
      ),
    );
    expect(responseBody(records)).toStrictEqual({
      text: "a".repeat(64 * 1024),
      size: 70003,
      truncated: true,
    });
  });

  it("NUL を含む本文は、テキストとして記録しない", async () => {
    const { records } = await run(
      oneServer(
        `(req, res) => res.end(Buffer.from([0, 1, 2]))`,
        `await (await fetch(base)).arrayBuffer();`,
      ),
    );
    expect(responseBody(records)).toStrictEqual({ text: null, size: 3, truncated: false });
  });

  it("訪問者の処理が待ってから本文を読んでも、訪問者は本文を受け取れる", async () => {
    const { text } = await run(
      oneServer(
        String.raw`async (req, res) => {
          await new Promise((r) => setTimeout(r, 50));
          let body = "";
          for await (const c of req) body += c;
          res.end("got " + body);
        }`,
        `console.log(await (await fetch(base, { method: "POST", body: "late" })).text());`,
      ),
    );
    expect(text).toStrictEqual(["got late"]);
  });

  it("レスポンスを返す前に切れた通信は、response を null にする", async () => {
    const { records } = await run(
      oneServer(`(req, res) => req.socket.destroy()`, `await fetch(base).catch(() => {});`),
    );
    expect(exchanges(records)[0]?.response).toBeNull();
  });

  it("応答の直後にサーバーを閉じても、受けたポートを記録する", async () => {
    const { records } = await run(String.raw`
const http = require("node:http");
const server = http.createServer((req, res) => { res.end("ok"); server.close(); });
server.listen(3000, "127.0.0.1", () => fetch("http://127.0.0.1:3000/").then((r) => r.text()));
`);
    expect(exchanges(records).map((r) => r.to)).toStrictEqual([3000]);
  });

  it("同じリクエストで request を出し直しても、1 回だけ記録する", async () => {
    const { records } = await run(
      oneServer(
        `function (req, res) { if (!req.again) { req.again = true; this.emit("request", req, res); return; } res.end("ok"); }`,
        `await (await fetch(base)).text();`,
      ),
    );
    expect(exchanges(records)).toHaveLength(1);
  });
});
