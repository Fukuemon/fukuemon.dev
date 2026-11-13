import { describe, expect, it } from "vitest";

import { playgroundConfigSchema, playgroundProjectSchema } from "./index";

const sqlProject = {
  tool: "sql",
  version: "v1",
  files: { "query.sql": "select 1;" },
  open: "query.sql",
  initialSql: "create table t (id int);",
};

describe("playgroundProjectSchema", () => {
  it("SQL のツールのプロジェクトを受け付ける", () => {
    expect(playgroundProjectSchema.parse(sqlProject)).toEqual(sqlProject);
  });

  it("Node の実行環境のプロジェクトは start を求める", () => {
    const node = { ...sqlProject, tool: "node" };
    expect(playgroundProjectSchema.safeParse(node).success).toBe(false);
    expect(
      playgroundProjectSchema.safeParse({
        ...node,
        start: [{ command: "node", args: ["index.js"], name: "server" }],
      }).success,
    ).toBe(true);
  });

  it("open が files に無いときは受け付けない", () => {
    const result = playgroundProjectSchema.safeParse({ ...sqlProject, open: "missing.sql" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["open"]);
  });

  it("知らないツールを受け付けない", () => {
    expect(playgroundProjectSchema.safeParse({ ...sqlProject, tool: "ruby" }).success).toBe(false);
  });
});

describe("playgroundConfigSchema", () => {
  it("初期データの SQL をファイルのパスで受け付ける", () => {
    const config = { tool: "sql", open: "query.sql", initialSql: "seed.sql" };
    expect(playgroundConfigSchema.parse(config)).toEqual(config);
  });
});
