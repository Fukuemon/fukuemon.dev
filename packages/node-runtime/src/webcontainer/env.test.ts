import { describe, expect, it } from "vitest";

import { spawnOptions, visitorEnv } from "./env";

const files = {
  portsFile: "/tmp/r/ports.json",
  httpTraceFile: "/tmp/r/http-trace.cjs",
  keepAliveFile: "/tmp/r/keep-alive.cjs",
};

describe("visitorEnv", () => {
  it("DB を使わないときは、ポートの URL を書くファイルと、HTTP を記録する preload を渡す", () => {
    expect(visitorEnv({ database: false, ...files })).toStrictEqual({
      PLAYGROUND_PORTS_FILE: "/tmp/r/ports.json",
      NODE_OPTIONS: "--require /tmp/r/http-trace.cjs",
    });
  });

  it("DB を使うときは、ADR-0053 の接続先と、終了させない preload を足す", () => {
    expect(visitorEnv({ database: true, ...files })).toStrictEqual({
      PLAYGROUND_PORTS_FILE: "/tmp/r/ports.json",
      NODE_OPTIONS: "--require /tmp/r/http-trace.cjs --require /tmp/r/keep-alive.cjs",
      PGHOST: "/tmp",
      PGUSER: "postgres",
      PGDATABASE: "postgres",
      DATABASE_URL: "postgres://postgres@%2Ftmp/postgres",
    });
  });
});

describe("spawnOptions", () => {
  const env = { NODE_OPTIONS: "--require /tmp/r/http-trace.cjs" };
  const terminal = { cols: 80, rows: 24 };

  it.each([
    ["internal のプロセスには、環境変数も端末も渡さない", { internal: true }, {}],
    ["訪問者のプロセスには、環境変数とデフォルトの端末の大きさを渡す", {}, { env, terminal }],
    [
      "訪問者のプロセスに端末の大きさを指定したときは、その大きさを渡す",
      { terminal: { cols: 120, rows: 40 } },
      { env, terminal: { cols: 120, rows: 40 } },
    ],
  ])("%s", (_name, options, expected) => {
    expect(spawnOptions(options, env, terminal)).toStrictEqual(expected);
  });
});
