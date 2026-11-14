import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { embedUrl, projectDir, readProject } from "./project";

function projectFiles(files: Record<string, string | Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), "playground-project-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

const START = [{ command: "node", args: ["index.js"], name: "サーバー" }];
const NODE_CONFIG = JSON.stringify({ tool: "node", open: "index.js", start: START });
const HASH = expect.stringMatching(/^[0-9a-f]{64}$/);
const config = (value: object) => JSON.stringify(value);

describe("プロジェクトのディレクトリを読む", () => {
  it("設定のファイルを除いたファイルを files にし、設定の値と version を持つ", () => {
    const dir = projectFiles({
      "playground.json": NODE_CONFIG,
      "index.js": "console.log(1);",
      "src/lib/a.js": "export {};",
    });
    expect(readProject(dir)).toStrictEqual({
      tool: "node",
      open: "index.js",
      start: START,
      files: { "index.js": "console.log(1);", "src/lib/a.js": "export {};" },
      version: HASH,
    });
  });

  it("initialSql を、指したファイルの中身に置き換える", () => {
    const dir = projectFiles({
      "playground.json": config({ tool: "sql", open: "q.sql", initialSql: "seed.sql" }),
      "q.sql": "select 1;",
      "seed.sql": "create table t (id int);",
    });
    expect(readProject(dir)).toStrictEqual({
      tool: "sql",
      open: "q.sql",
      initialSql: "create table t (id int);",
      files: { "q.sql": "select 1;", "seed.sql": "create table t (id int);" },
      version: HASH,
    });
  });

  it("同じ初期ファイルからは、同じ version を求める", () => {
    const files = { "playground.json": NODE_CONFIG, "index.js": "a" };
    expect(readProject(projectFiles(files)).version).toBe(readProject(projectFiles(files)).version);
  });

  it("初期ファイルを変えると、version が変わる", () => {
    const files = { "playground.json": NODE_CONFIG, "index.js": "a" };
    expect(readProject(projectFiles({ ...files, "index.js": "b" })).version).not.toBe(
      readProject(projectFiles(files)).version,
    );
  });

  it.each([
    ["設定のファイルが無い", { "index.js": "" }, "playground.json が無い"],
    ["設定が JSON でない", { "playground.json": "{" }, "playground.json を読めない"],
    [
      "設定が schema に合わない",
      { "playground.json": config({ tool: "ruby", open: "a" }) },
      "playground.json を読めない",
    ],
    [
      "open が無いファイルを指す",
      { "playground.json": config({ tool: "go", open: "main.go" }) },
      "schema に合わない",
    ],
    [
      "initialSql が指すファイルが無い",
      {
        "playground.json": config({ tool: "sql", open: "q.sql", initialSql: "x.sql" }),
        "q.sql": "",
      },
      "initialSql は、プロジェクトのファイルを指す: x.sql",
    ],
    [
      "initialSql がプロジェクトの外を指す",
      {
        "playground.json": config({ tool: "sql", open: "q.sql", initialSql: "../q.sql" }),
        "q.sql": "",
      },
      "initialSql は、プロジェクトのファイルを指す: ../q.sql",
    ],
    [
      "ドットで始まるファイルがある",
      { "playground.json": config({ tool: "go", open: "main.go" }), "main.go": "", ".env": "A=1" },
      "ドットで始まるファイルかディレクトリがある: .env",
    ],
    [
      "ドットで始まるディレクトリの下にファイルがある",
      {
        "playground.json": config({ tool: "go", open: "main.go" }),
        "main.go": "",
        ".config/a.json": "{}",
      },
      "ドットで始まるファイルかディレクトリがある: .config/a.json",
    ],
    [
      "UTF-8 として読めないファイルがある",
      {
        "playground.json": config({ tool: "go", open: "main.go" }),
        "main.go": "",
        "a.png": new Uint8Array([0xff, 0xfe]),
      },
      "a.png を UTF-8 の文字列として読めない",
    ],
  ])("%s ときは失敗する", (_, files, message) => {
    expect(() => readProject(projectFiles(files))).toThrow(message);
  });
});

describe("埋め込みの名前と URL", () => {
  it("記事の Markdown があるディレクトリの playground/<名前>/ を指す", () => {
    expect(projectDir("src/content/articles/s/a.md", "x")).toBe(
      "src/content/articles/s/playground/x",
    );
  });

  it("iframe の URL のクエリには、埋め込みの ID だけを書く", () => {
    expect(embedUrl("https://play.example", "node", "a/b")).toBe(
      "https://play.example/node/?project=a/b",
    );
  });
});
