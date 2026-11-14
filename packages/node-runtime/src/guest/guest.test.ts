import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSqlRequest } from "./db-protocol";

const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

describe("DB のプロセスの依存", () => {
  const guest = readJson("./db-package.json").dependencies ?? {};

  it("PGlite のバージョンを、@fukuemon/sql-runtime の依存と同じにする", () => {
    const sql = readJson("../../../sql-runtime/package.json").dependencies ?? {};
    expect(guest["@electric-sql/pglite"]).toBe(sql["@electric-sql/pglite"]);
  });

  const dev = readJson("../../package.json").devDependencies ?? {};

  it.each(Object.entries(guest))("%s のバージョンを、範囲ではなく 1 つの値で書く", (_, version) => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(Object.entries(guest))(
    "%s のバージョンを、型を読む devDependencies と同じにする",
    (name, version) => {
      expect(dev[name]).toBe(version);
    },
  );
});

describe("parseSqlRequest", () => {
  it("id と sql が文字列の行を、リクエストにする", () => {
    expect(parseSqlRequest('{"id":"1","sql":"select 1"}')).toStrictEqual({
      id: "1",
      sql: "select 1",
    });
  });

  it.each(["", "{", "null", "1", '{"id":1,"sql":"x"}', '{"id":"1"}'])(
    "形に合わない行 %j は、undefined を返す",
    (line) => {
      expect(parseSqlRequest(line)).toBeUndefined();
    },
  );
});

/** keep-alive.cjs を --require で読んだ Node で script を実行し、標準出力を返す。 */
function runWithKeepAlive(script: string, env: Record<string, string>) {
  const preload = new URL("./keep-alive.cjs", import.meta.url).pathname;
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["--require", preload, "-e", script], {
      env: { ...process.env, ...env },
    });
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}`))));
  });
}

describe("keep-alive.cjs", () => {
  it("パスに接続している間だけタイマーを置き、接続が閉じたら外す", async () => {
    const directory = mkdtempSync(join(tmpdir(), "keep-alive-"));
    const path = join(directory, "s");
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(path, resolve));
    try {
      const script = [
        "const net = require('node:net');",
        "const timers = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;",
        "const socket = net.connect(process.env.SOCKET_PATH);",
        "console.log(timers());",
        "socket.on('close', () => setImmediate(() => console.log(timers())));",
      ].join("\n");
      const out = await runWithKeepAlive(script, { SOCKET_PATH: path });
      expect(out.trim().split("\n")).toStrictEqual(["1", "0"]);
    } finally {
      server.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("ポートへの接続には、タイマーを置かない", async () => {
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const script = [
        "const net = require('node:net');",
        "const socket = net.connect(Number(process.env.PORT), '127.0.0.1');",
        "console.log(process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length);",
        "socket.on('close', () => undefined);",
      ].join("\n");
      expect((await runWithKeepAlive(script, { PORT: String(port) })).trim()).toBe("0");
    } finally {
      server.close();
    }
  });
});
