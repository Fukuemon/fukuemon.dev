import { describe, expect, it } from "vitest";

import {
  isEmbedId,
  isEmbedName,
  playgroundConfigSchema,
  playgroundProjectSchema,
  toEmbedId,
} from "./index";

const sqlProject = {
  tool: "sql",
  version: "v1",
  files: { "query.sql": "select 1;" },
  open: "query.sql",
  initialSql: "create table t (id int);",
};

const start = [{ command: "node", args: ["index.js"], name: "server" }];

describe("playgroundProjectSchema", () => {
  it("SQL のツールのプロジェクトを受け付ける", () => {
    expect(playgroundProjectSchema.parse(sqlProject)).toStrictEqual(sqlProject);
  });

  it("start を持つ Node の実行環境のプロジェクトを受け付ける", () => {
    const node = { ...sqlProject, tool: "node", start };
    expect(playgroundProjectSchema.parse(node)).toStrictEqual(node);
  });

  it.each([
    ["start の無い Node の実行環境のプロジェクト", { ...sqlProject, tool: "node" }],
    ["知らないツールのプロジェクト", { ...sqlProject, tool: "ruby" }],
  ])("%s を受け付けない", (_, project) => {
    expect(playgroundProjectSchema.safeParse(project).success).toBe(false);
  });

  const projects = {
    node: { ...sqlProject, tool: "node", start },
    sql: sqlProject,
    go: { tool: "go", version: "v1", files: { "main.go": "package main" }, open: "main.go" },
  };
  // JSON.parse で作る。オブジェクトのリテラルの __proto__ は、own のキーにならない
  const withFile = (tool: keyof typeof projects, path: string) => {
    const project = projects[tool];
    return JSON.parse(
      JSON.stringify({ ...project, files: { ...project.files } }).replace(
        '"files":{',
        `"files":{${JSON.stringify(path)}:"x",`,
      ),
    ) as unknown;
  };
  const tools = Object.keys(projects) as (keyof typeof projects)[];
  const unsafePaths = [
    "",
    "/etc/passwd",
    "src//a.js",
    "a/",
    ".",
    "./a.js",
    "..",
    "../a.js",
    "src/../../a.js",
    "__proto__",
    "src/__proto__",
    "src\\a.js",
    "a\0.js",
  ];

  it.each(tools.flatMap((tool) => unsafePaths.map((path) => [tool, path] as const)))(
    "%s のツールの files の %j のキーを受け付けない",
    (tool, path) => {
      const result = playgroundProjectSchema.safeParse(withFile(tool, path));
      expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["files"]]);
    },
  );

  it.each(tools)(
    "%s のツールの、ディレクトリの下のパスと、. で始まる名前のキーを受け付ける",
    (tool) => {
      expect(playgroundProjectSchema.safeParse(withFile(tool, "src/lib/.env.js")).success).toBe(
        true,
      );
    },
  );

  it.each([
    ["null", null],
    ["文字列", "x"],
    ["配列", []],
  ])("files が %s のときは、例外を投げずに files の誤りにする", (_, files) => {
    const result = playgroundProjectSchema.safeParse({ ...sqlProject, files });
    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["files"]]);
  });

  it("open が files に無いときは、open の誤りにする", () => {
    const result = playgroundProjectSchema.safeParse({ ...sqlProject, open: "missing.sql" });
    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["open"]]);
  });
});

describe("playgroundConfigSchema", () => {
  it("初期データの SQL をファイルのパスで受け付ける", () => {
    const config = { tool: "sql", open: "query.sql", initialSql: "seed.sql" };
    expect(playgroundConfigSchema.parse(config)).toStrictEqual(config);
  });
});

describe("埋め込みの名前と ID", () => {
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

  it.each([
    ["intro/server", true],
    ["intro", false],
    ["intro/../x", false],
    ["a/b/c", false],
    ["a/b?x=1", false],
  ])("%s を埋め込みの ID として %s にする", (id, ok) => {
    expect(isEmbedId(id)).toBe(ok);
  });

  it("contentId と名前から、/ でつないだ埋め込みの ID を組み立てる", () => {
    expect(toEmbedId("intro", "server")).toBe("intro/server");
  });
});
