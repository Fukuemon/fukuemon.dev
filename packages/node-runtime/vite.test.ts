import { describe, expect, it } from "vitest";

import { guestBundle } from "./vite";

const dbServer = new URL("./src/guest/db-server.ts", import.meta.url).pathname;

describe("guestBundle", () => {
  it("DB のプロセスのスクリプトを、PGlite と pglite-socket を除いて 1 つの文字列に束ねる", async () => {
    const plugin = guestBundle();
    const watched: string[] = [];
    const load = plugin.load as (this: unknown, id: string) => Promise<string | null>;
    const id = `${dbServer}?bundle`;
    const module = await load.call({ addWatchFile: (file: string) => watched.push(file) }, id);
    const source = String(
      JSON.parse(module?.replace(/^export default /, "").replace(/;$/, "") ?? '""'),
    );
    expect({
      pglite: source.includes('from "@electric-sql/pglite"'),
      socket: source.includes('from "@electric-sql/pglite-socket"'),
      workspace: source.includes("@fukuemon/sql-runtime"),
      prefix: source.includes("@@fd:sql "),
      watchesSqlRuntime: watched.some((file) => file.endsWith("sql-runtime/src/index.ts")),
    }).toStrictEqual({
      pglite: true,
      socket: true,
      workspace: false,
      prefix: true,
      watchesSqlRuntime: true,
    });
  });

  it("resolveId は、?bundle を付けた import を、解決したパスに ?bundle を付けて返す", async () => {
    const plugin = guestBundle();
    const resolveId = plugin.resolveId as (
      this: unknown,
      source: string,
      importer: string,
    ) => Promise<string | null>;
    const context = { resolve: async (source: string) => ({ id: `/abs/${source}` }) };
    expect(await resolveId.call(context, "./x.ts?bundle", "/abs/y.ts")).toBe("/abs/./x.ts?bundle");
  });

  it("resolveId は、?bundle の付かない import と、解決できない import を扱わない", async () => {
    const plugin = guestBundle();
    const resolveId = plugin.resolveId as (
      this: unknown,
      source: string,
      importer: string,
    ) => Promise<string | null>;
    const context = { resolve: async () => null };
    expect([
      await resolveId.call(context, "./x.ts", "/y.ts"),
      await resolveId.call(context, "./x.ts?bundle", "/y.ts"),
    ]).toStrictEqual([null, null]);
  });

  it("?bundle の付かない import は、扱わない", async () => {
    const plugin = guestBundle();
    const load = plugin.load as (this: unknown, id: string) => Promise<string | null>;
    expect(await load.call({}, "/x.ts")).toBeNull();
  });
});
