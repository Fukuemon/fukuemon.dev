import { describe, expect, it } from "vitest";

import { visitorEnv } from "./env";

const files = { portsFile: "/tmp/r/ports.json", keepAliveFile: "/tmp/r/keep-alive.cjs" };

describe("visitorEnv", () => {
  it("DB を使わないときは、ポートの URL を書くファイルだけを渡す", () => {
    expect(visitorEnv({ database: false, ...files })).toStrictEqual({
      PLAYGROUND_PORTS_FILE: "/tmp/r/ports.json",
    });
  });

  it("DB を使うときは、ADR-0053 の接続先と、終了させない preload を渡す", () => {
    expect(visitorEnv({ database: true, ...files })).toStrictEqual({
      PLAYGROUND_PORTS_FILE: "/tmp/r/ports.json",
      NODE_OPTIONS: "--require /tmp/r/keep-alive.cjs",
      PGHOST: "/tmp",
      PGUSER: "postgres",
      PGDATABASE: "postgres",
      DATABASE_URL: "postgres://postgres@%2Ftmp/postgres",
    });
  });
});
