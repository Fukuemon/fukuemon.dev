import type { PlaygroundProject } from "@fukuemon/playground-project";
import { describe, expect, it, vi } from "vitest";

import { createProjectLoader, fetchProject, projectUrl } from "./project";

const sqlProject = {
  tool: "sql",
  version: "v1",
  files: { "query.sql": "select 1;" },
  open: "query.sql",
} satisfies PlaygroundProject;

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), init));

describe("projectUrl", () => {
  it("埋め込みの ID から、fukuemon.dev の JSON の URL を作る", () => {
    expect(projectUrl("btree-index/explain")).toBe(
      "https://fukuemon.dev/playground-projects/btree-index/explain.json",
    );
  });
});

describe("fetchProject", () => {
  it("schema に合い、ツールが同じプロジェクトを開く", async () => {
    const fetchJson = respond(sqlProject);
    expect(await fetchProject("a/b", "sql", fetchJson)).toEqual({
      kind: "opened",
      project: sqlProject,
      embedId: "a/b",
    });
    expect(fetchJson).toHaveBeenCalledWith("https://fukuemon.dev/playground-projects/a/b.json");
  });

  it.each([
    ["形の誤った埋め込みの ID", "../secret", respond(sqlProject)],
    ["404", "a/b", respond({}, { status: 404 })],
    ["schema に合わない JSON", "a/b", respond({ tool: "sql" })],
    ["ほかのツールのプロジェクト", "a/b", respond({ ...sqlProject, tool: "go" })],
    ["JSON でない本文", "a/b", vi.fn<typeof fetch>(async () => new Response("<html>"))],
    [
      "取得の失敗",
      "a/b",
      vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("offline"))),
    ],
  ])("%s は、開けなかったことにする", async (_, embedId, fetchJson) => {
    expect(await fetchProject(embedId, "sql", fetchJson)).toEqual({ kind: "failed", embedId });
  });

  it("形の誤った埋め込みの ID では、取得しない", async () => {
    const fetchJson = respond(sqlProject);
    await fetchProject("a/b?x=1", "sql", fetchJson);
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

describe("createProjectLoader", () => {
  const defaultProject = { ...sqlProject, version: "default" };

  it("project が無いときは、デフォルトのプロジェクトを開く", async () => {
    const load = createProjectLoader("sql", defaultProject, respond(sqlProject));
    expect(await load("")).toEqual({ kind: "opened", project: defaultProject });
  });

  it("同じ埋め込みの ID には、同じ Promise を返し、1 回だけ取得する", () => {
    const fetchJson = respond(sqlProject);
    const load = createProjectLoader("sql", defaultProject, fetchJson);
    expect(load("?project=a/b")).toBe(load("?project=a/b"));
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});
