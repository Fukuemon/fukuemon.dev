import { describe, expect, it } from "vitest";

import { playgroundConfigSchema, playgroundProjectSchema } from "./index";

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
