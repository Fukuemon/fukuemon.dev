import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { embedUrl, isEmbedName, playgroundOrigin, projectDir, readProject } from "./project";

function projectFiles(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "playground-project-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

const NODE_CONFIG = JSON.stringify({
  tool: "node",
  open: "index.js",
  start: [{ command: "node", args: ["index.js"], name: "サーバー" }],
});

describe("プロジェクトのディレクトリを読む", () => {
  it("設定のファイルを除いたファイルを files にし、設定の値を残す", () => {
    const dir = projectFiles({
      "playground.json": NODE_CONFIG,
      "index.js": "console.log(1);",
      "src/lib/a.js": "export {};",
    });
    const project = readProject(dir);
    expect(project.files).toStrictEqual({
      "index.js": "console.log(1);",
      "src/lib/a.js": "export {};",
    });
    expect(project).toMatchObject({ tool: "node", open: "index.js" });
    expect(project.version).toMatch(/^[0-9a-f]{64}$/);
  });

  it("initialSql を、指したファイルの中身に置き換える", () => {
    const dir = projectFiles({
      "playground.json": JSON.stringify({ tool: "sql", open: "q.sql", initialSql: "seed.sql" }),
      "q.sql": "select 1;",
      "seed.sql": "create table t (id int);",
    });
    expect(readProject(dir)).toMatchObject({ initialSql: "create table t (id int);" });
  });

  it("初期ファイルを変えると version が変わり、変えなければ同じになる", () => {
    const files = { "playground.json": NODE_CONFIG, "index.js": "a" };
    const before = readProject(projectFiles(files)).version;
    expect(readProject(projectFiles(files)).version).toBe(before);
    expect(readProject(projectFiles({ ...files, "index.js": "b" })).version).not.toBe(before);
  });

  it("設定のファイルが無いときは失敗する", () => {
    expect(() => readProject(projectFiles({ "index.js": "" }))).toThrow("playground.json が無い");
  });

  it("設定が schema に合わないときは失敗する", () => {
    const dir = projectFiles({ "playground.json": JSON.stringify({ tool: "ruby", open: "a" }) });
    expect(() => readProject(dir)).toThrow();
  });

  it("open が無いファイルを指すときは失敗する", () => {
    const dir = projectFiles({
      "playground.json": JSON.stringify({ tool: "go", open: "main.go" }),
    });
    expect(() => readProject(dir)).toThrow("schema に合わない");
  });
});

describe("埋め込みの名前と URL", () => {
  it.each([
    ["server", true],
    ["node-2", true],
    ["Server", false],
    ["-a", false],
    ["a/b", false],
    ["", false],
  ])("%s を名前として %s にする", (name, ok) => {
    expect(isEmbedName(name)).toBe(ok);
  });

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

  it("origin は、環境変数が無いときに play.fukuemon.dev にする", () => {
    expect(playgroundOrigin({})).toBe("https://play.fukuemon.dev");
    expect(playgroundOrigin({ PUBLIC_PLAYGROUND_ORIGIN: "http://localhost:5173" })).toBe(
      "http://localhost:5173",
    );
  });
});
