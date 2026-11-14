import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const PRELOAD = fileURLToPath(new URL("./http-trace.cjs", import.meta.url));
const PREFIX = "@@fd:http ";

type Line = Record<string, unknown> & { type: string };

/** preload を読み込んだ Node で script を動かし、標準出力の記録の行と、ほかの行を分けて返す。 */
async function run(script: string): Promise<{ records: Line[]; text: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), "http-trace-"));
  const file = join(dir, "main.cjs");
  await writeFile(file, script);
  const { stdout } = await promisify(execFile)(process.execPath, [file], {
    env: { ...process.env, NODE_OPTIONS: `--require ${PRELOAD}` },
    timeout: 10_000,
  });
  const lines = stdout.split("\n").filter(Boolean);
  return {
    records: lines
      .filter((l) => l.startsWith(PREFIX))
      .map((l) => JSON.parse(l.slice(PREFIX.length)) as Line),
    text: lines.filter((l) => !l.startsWith(PREFIX)),
  };
}

const exchanges = (records: Line[]) => records.filter((r) => r.type === "exchange");

// 2 つのサーバーを待ち受け、片方がもう片方へ fetch する。手続きは、ポートを 0 にして空いた番号を使う
const TWO_SERVERS = String.raw`
const http = require("node:http");
const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)));
(async () => {
  const auth = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ got: body }));
    });
  });
  const authPort = await listen(auth);
  const client = http.createServer(async (req, res) => {
    if (req.url === "/login") {
      res.writeHead(302, { location: "/next", "set-cookie": ["state=a; HttpOnly", "other=b"] });
      res.end();
      return;
    }
    const r = await fetch("http://localhost:" + authPort + "/token", { method: "POST", body: "code=x" });
    res.end(await r.text());
  });
  const clientPort = await listen(client);
  console.log("ports", clientPort, authPort);
  await fetch("http://127.0.0.1:" + clientPort + "/login", { redirect: "manual" });
  const final = await fetch("http://127.0.0.1:" + clientPort + "/callback");
  console.log("final", await final.text());
  auth.close();
  client.close();
})();
`;

describe("http-trace", () => {
  it("待ち受けたポートと、受けたリクエストとレスポンスを、1 行ずつ記録する", async () => {
    const { records, text } = await run(TWO_SERVERS);
    const [clientPort, authPort] = (
      text
        .find((l) => l.startsWith("ports"))
        ?.split(" ")
        .slice(1) ?? []
    ).map(Number);
    expect(records.filter((r) => r.type === "listen").map((r) => r.port)).toEqual([
      authPort,
      clientPort,
    ]);
    expect(text).toContain('final {"got":"code=x"}');

    const [login, token, callback] = exchanges(records);
    expect(login).toMatchObject({
      method: "GET",
      url: "/login",
      to: clientPort,
      response: { status: 302 },
    });
    expect(login?.response).toMatchObject({
      headers: expect.arrayContaining([
        { name: "location", value: "/next" },
        { name: "set-cookie", value: "state=a; HttpOnly" },
        { name: "set-cookie", value: "other=b" },
      ]),
    });
    expect(token).toMatchObject({
      method: "POST",
      url: "/token",
      to: authPort,
      from: String(clientPort),
      request: { body: { text: "code=x", size: 6, truncated: false } },
      response: { status: 200, body: { text: '{"got":"code=x"}', truncated: false } },
    });
    expect(callback).toMatchObject({ url: "/callback", to: clientPort });
  });

  it("待ち受けていないプロセスの fetch は、プロセスの ID を送信元にする", async () => {
    const { records } = await run(String.raw`
const http = require("node:http");
const server = http.createServer((req, res) => res.end("ok"));
server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  // 子のプロセスは、NODE_OPTIONS を受け継ぎ、preload を読む
  const code = "fetch('http://localhost:" + port + "/').then(() => process.exit(0))";
  require("node:child_process").execFile(process.execPath, ["-e", code], () => server.close());
});
`);
    const [exchange] = exchanges(records);
    expect(exchange?.from).toMatch(/^pid-\d+$/);
  });

  it("訪問者が付けた送信元のヘッダは、書き換えない", async () => {
    const { records } = await run(String.raw`
const http = require("node:http");
const server = http.createServer((req, res) => res.end("ok"));
server.listen(0, "127.0.0.1", async () => {
  const url = "http://127.0.0.1:" + server.address().port + "/";
  await fetch(new Request(url, { headers: { "x-playground-from": "mine", accept: "text/plain" } }));
  server.close();
});
`);
    const [exchange] = exchanges(records);
    expect(exchange?.from).toBe("mine");
    expect(exchange?.request).toMatchObject({
      headers: expect.arrayContaining([{ name: "accept", value: "text/plain" }]),
    });
  });

  it("本文は、64 KB で切り、テキストとして読めないものは text を null にする", async () => {
    const { records } = await run(String.raw`
const http = require("node:http");
const server = http.createServer((req, res) => {
  if (req.url === "/big") res.end("あ".repeat(30000));
  else res.end(Buffer.from([0, 1, 2]));
});
server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  await (await fetch(base + "/big")).text();
  await (await fetch(base + "/bin")).arrayBuffer();
  server.close();
});
`);
    const [big, bin] = exchanges(records);
    const body = (big?.response as { body: { text: string; size: number; truncated: boolean } })
      .body;
    expect(body.size).toBe(90000);
    expect(body.truncated).toBe(true);
    expect(body.text).toBe("あ".repeat(Math.floor((64 * 1024) / 3)));
    expect(bin?.response).toMatchObject({ body: { text: null, size: 3, truncated: false } });
  });

  it("訪問者の処理が、待ってから本文を読んでも、本文を受け取れる", async () => {
    const { records, text } = await run(String.raw`
const http = require("node:http");
const server = http.createServer(async (req, res) => {
  await new Promise((r) => setTimeout(r, 50));
  let body = "";
  for await (const c of req) body += c;
  res.end("got " + body);
});
server.listen(0, "127.0.0.1", async () => {
  const r = await fetch("http://127.0.0.1:" + server.address().port, { method: "POST", body: "late" });
  console.log(await r.text());
  server.close();
});
`);
    expect(text).toContain("got late");
    expect(exchanges(records)[0]?.request).toMatchObject({ body: { text: "late" } });
  });
});
