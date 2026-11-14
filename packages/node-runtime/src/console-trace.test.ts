import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { CONSOLE_PREFIX, parseConsoleLine } from "./console-records";

const PRELOAD = fileURLToPath(new URL("./guest/console-trace.cjs", import.meta.url));

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** preload を読み込んだ Node で script を動かし、記録の行を読んだものと、ほかの出力を返す。 */
async function run(script: string) {
  const dir = await mkdtemp(join(tmpdir(), "console-trace-"));
  dirs.push(dir);
  const file = join(dir, "main.cjs");
  await writeFile(file, script);
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [file], {
    env: { ...process.env, NODE_OPTIONS: `--require ${PRELOAD}` },
    timeout: 10_000,
  });
  const lines = stdout.split("\n").filter(Boolean);
  return {
    records: lines
      .filter((line) => line.startsWith(CONSOLE_PREFIX))
      .map((line) => parseConsoleLine(line.slice(CONSOLE_PREFIX.length))),
    stdout: lines.filter((line) => !line.startsWith(CONSOLE_PREFIX)),
    stderr: stderr.split("\n").filter(Boolean),
  };
}

const argsOf = async (expression: string) => {
  const { records } = await run(`console.log(${expression});`);
  return records[0]?.args;
};

describe("console-trace.cjs", () => {
  it("ログレベルごとに 1 行の記録を書き、元の出力も残す", async () => {
    const { records, stdout, stderr } = await run(
      `for (const level of ["debug", "log", "info", "warn", "error"]) console[level](level + "!");`,
    );
    expect(records.map((record) => record?.level)).toStrictEqual([
      "debug",
      "log",
      "info",
      "warn",
      "error",
    ]);
    expect(records[3]?.args).toStrictEqual([{ kind: "string", value: "warn!" }]);
    expect(stdout).toStrictEqual(["debug!", "log!", "info!"]);
    expect(stderr).toStrictEqual(["warn!", "error!"]);
  });

  it("記録に、呼んだ時刻を入れる", async () => {
    const before = Date.now();
    const { records } = await run(`console.log("x");`);
    expect(records[0]?.time).toBeGreaterThanOrEqual(before);
    expect(records[0]?.time).toBeLessThanOrEqual(Date.now());
  });

  it("入れ子のオブジェクトと配列を、項目の名前と値の木にする", async () => {
    expect(await argsOf(`{ user: { name: "a", tags: ["x", 1] } }`)).toStrictEqual([
      {
        kind: "object",
        entries: [
          {
            key: "user",
            value: {
              kind: "object",
              entries: [
                { key: "name", value: { kind: "string", value: "a" } },
                {
                  key: "tags",
                  value: {
                    kind: "array",
                    items: [
                      { kind: "string", value: "x" },
                      { kind: "number", value: 1 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ]);
  });

  it("JSON で運べない数と、bigint、symbol、関数、null、undefined を区別する", async () => {
    expect(
      await argsOf(`NaN, -0, Infinity, 10n, Symbol("s"), function named() {}, null, undefined`),
    ).toStrictEqual([
      { kind: "number", value: Number.NaN },
      { kind: "number", value: -0 },
      { kind: "number", value: Number.POSITIVE_INFINITY },
      { kind: "bigint", value: "10" },
      { kind: "symbol", description: "s" },
      { kind: "function", name: "named" },
      { kind: "null" },
      { kind: "undefined" },
    ]);
  });

  it("Error、Map、Set、クラスのインスタンスを区別する", async () => {
    const args = await argsOf(
      `new TypeError("bad"), new Map([["k", 1]]), new Set([true]), new (class Point { constructor() { this.x = 1; } })()`,
    );
    expect(args?.[0]).toMatchObject({ kind: "error", name: "TypeError", message: "bad" });
    expect(args?.[0]).toHaveProperty("stack.0", expect.stringMatching(/^at /));
    expect(args?.slice(1)).toStrictEqual([
      {
        kind: "map",
        entries: [{ key: { kind: "string", value: "k" }, value: { kind: "number", value: 1 } }],
      },
      { kind: "set", items: [{ kind: "boolean", value: true }] },
      {
        kind: "object",
        className: "Point",
        entries: [{ key: "x", value: { kind: "number", value: 1 } }],
      },
    ]);
  });

  it("循環した参照は circular にし、同じ値を 2 か所に持つだけのものは両方を写す", async () => {
    const { records } = await run(
      `const shared = { v: 1 }; const a = { shared, again: shared }; a.self = a; console.log(a);`,
    );
    const value = { kind: "object", entries: [{ key: "v", value: { kind: "number", value: 1 } }] };
    expect(records[0]?.args).toStrictEqual([
      {
        kind: "object",
        entries: [
          { key: "shared", value },
          { key: "again", value },
          { key: "self", value: { kind: "circular" } },
        ],
      },
    ]);
  });

  it("getter、toJSON、Proxy の罠を動かさない", async () => {
    const { records, stdout } = await run(
      [
        `const touched = [];`,
        `const target = { toJSON() { touched.push("toJSON"); return 1; } };`,
        `Object.defineProperty(target, "lazy", { enumerable: true, get() { touched.push("get"); return 1; } });`,
        `const proxy = new Proxy({}, { ownKeys() { touched.push("ownKeys"); return []; } });`,
        `console.log(target, proxy);`,
        `process.stdout.write("touched:" + touched.join(",") + "\\n");`,
      ].join("\n"),
    );
    expect(stdout.at(-1)).toBe("touched:");
    expect(records[0]?.args).toStrictEqual([
      {
        kind: "object",
        entries: [
          { key: "toJSON", value: { kind: "function", name: "toJSON" } },
          { key: "lazy", value: { kind: "text", value: "(...)" } },
        ],
      },
      { kind: "text", value: "Proxy" },
    ]);
  });

  it("上限を超えた深さ、要素の数、文字数を切る", async () => {
    const [deep, many, long] =
      (await argsOf(
        `{ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }, Array.from({ length: 101 }, (_, i) => i), "x".repeat(10001)`,
      )) ?? [];
    let node = deep;
    for (let depth = 0; depth < 6; depth += 1) {
      node = node?.kind === "object" ? node.entries[0]?.value : undefined;
    }
    expect(node).toStrictEqual({ kind: "text", value: "{…}" });
    expect(many?.kind === "array" && many.items.at(-1)).toStrictEqual({
      kind: "text",
      value: "…ほか 1 件",
    });
    expect(long?.kind === "string" && long.value.length).toBe(10001);
  });

  it("stdout の write を包んだコードが console を呼んでも、2 重に記録しない", async () => {
    const { records } = await run(
      [
        `const write = process.stdout.write;`,
        `process.stdout.write = function (...args) { if (!this.inner) { this.inner = true; console.info("wrapped"); this.inner = false; } return write.apply(this, args); };`,
        `console.log("outer");`,
      ].join("\n"),
    );
    expect(records.map((record) => record?.args[0])).toStrictEqual([
      { kind: "string", value: "outer" },
      { kind: "string", value: "wrapped" },
    ]);
  });
});
