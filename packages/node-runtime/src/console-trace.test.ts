import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { parseConsoleLine } from "./console-records";
import { CONSOLE_PREFIX } from "./record-lines";

const PRELOAD = fileURLToPath(new URL("./guest/console-trace.cjs", import.meta.url));

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

const STDOUT_TTY = fileURLToPath(new URL("./test/stdout-tty.cjs", import.meta.url));

/**
 * preload を読み込んだ Node で script を動かし、記録の行を読んだものと、ほかの出力を返す。
 * 標準出力はパイプで受けるので、tty が true のときは、preload より先に、標準出力を端末に見せる preload を読む。
 */
async function run(script: string, { tty = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "console-trace-"));
  dirs.push(dir);
  const file = join(dir, "main.cjs");
  await writeFile(file, script);
  const preloads = tty ? [STDOUT_TTY, PRELOAD] : [PRELOAD];
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [file], {
    env: { ...process.env, NODE_OPTIONS: preloads.map((path) => `--require ${path}`).join(" ") },
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
  const everyLevel = () =>
    run(
      `for (const level of ["debug", "log", "info", "warn", "error"]) console[level](level + "!");`,
    );

  it("ログレベルごとに 1 行の記録を書く", async () => {
    const { records } = await everyLevel();
    expect(records.map((record) => [record?.level, record?.args])).toStrictEqual(
      ["debug", "log", "info", "warn", "error"].map((level) => [
        level,
        [{ kind: "string", value: `${level}!` }],
      ]),
    );
  });

  it("元の出力も、標準出力と標準エラー出力に残す", async () => {
    const { stdout, stderr } = await everyLevel();
    expect({ stdout, stderr }).toStrictEqual({
      stdout: ["debug!", "log!", "info!"],
      stderr: ["warn!", "error!"],
    });
  });

  it("標準出力が端末でないときは記録の行を書かず、元の出力だけを残す", async () => {
    const { records, stdout, stderr } = await run(`console.log("a"); console.error("b");`, {
      tty: false,
    });
    expect({ records, stdout, stderr }).toStrictEqual({
      records: [],
      stdout: ["a"],
      stderr: ["b"],
    });
  });

  it("ワーカーのスレッドの console は、親のスレッドの標準出力が端末のときだけ記録する", async () => {
    const script = `new (require("node:worker_threads").Worker)('console.log("w")', { eval: true });`;
    const [tty, pipe] = await Promise.all([run(script), run(script, { tty: false })]);
    expect({
      tty: { args: tty.records.map((record) => record?.args), stdout: tty.stdout },
      pipe: { records: pipe.records, stdout: pipe.stdout },
    }).toStrictEqual({
      tty: { args: [[{ kind: "string", value: "w" }]], stdout: ["w"] },
      pipe: { records: [], stdout: ["w"] },
    });
  });

  it("記録に、呼んだ時刻を入れる", async () => {
    const before = Date.now();
    const { records } = await run(`console.log("x");`);
    const time = records[0]?.time ?? 0;
    expect(time >= before && time <= Date.now()).toBe(true);
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
    expect(args).toStrictEqual([
      {
        kind: "error",
        name: "TypeError",
        message: "bad",
        stack: expect.arrayContaining([expect.stringMatching(/^at /)]) as unknown,
      },
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

  const trapped = () =>
    run(
      [
        `const touched = [];`,
        `const target = { toJSON() { touched.push("toJSON"); return 1; } };`,
        `Object.defineProperty(target, "lazy", { enumerable: true, get() { touched.push("get"); return 1; } });`,
        `const proxy = new Proxy({}, { ownKeys() { touched.push("ownKeys"); return []; } });`,
        `console.log(target, proxy);`,
        `process.stdout.write("touched:" + touched.join(",") + "\\n");`,
      ].join("\n"),
    );

  it("getter、toJSON、Proxy の罠を動かさない", async () => {
    const { stdout } = await trapped();
    expect(stdout.at(-1)).toBe("touched:");
  });

  it("getter の項目は (...) にし、Proxy は文字にする", async () => {
    const { records } = await trapped();
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
    expect({
      node,
      last: many?.kind === "array" && many.items.at(-1),
      length: long?.kind === "string" && long.value.length,
    }).toStrictEqual({
      node: { kind: "text", value: "{…}" },
      last: { kind: "text", value: "…ほか 1 件" },
      length: 10001,
    });
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
