import type { FileContents } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import {
  SAVE_LIMIT,
  isExcludedFromSave,
  filesForRestart,
  filesToSave,
  withoutUnsaved,
} from "./save-rules";

const file = (path: string, text: string | null = "x", size = 1): FileContents => ({
  path,
  kind: "file",
  size,
  text,
});

describe("isExcludedFromSave", () => {
  it.each([
    "node_modules/a/index.js",
    ".git/HEAD",
    "dist/index.js",
    "web/.next/server.js",
    ".cache/a",
    ".turbo/a",
    ".nuxt/a",
    ".env",
    ".env.local",
    "server/.env",
    ".npmrc",
    "a/.netrc",
    "a/.envrc",
    ".yarnrc",
    ".yarnrc.yml",
    ".git-credentials",
  ])("%s は保存しない", (path) => {
    expect(isExcludedFromSave(path)).toBe(true);
  });

  it.each([
    "index.js",
    "build/index.js",
    "src/env.ts",
    ".environment",
    ".yarnrc.yaml",
    "distance.js",
  ])("%s は保存する", (path) => {
    expect(isExcludedFromSave(path)).toBe(false);
  });
});

describe("filesForRestart", () => {
  it("テキストとして読めないファイル、規則に合わないパス、リンクを除き、保存しないファイルは残す", () => {
    expect(
      filesForRestart([
        file("a.js", "a"),
        file("big.bin", null, 2_000_000),
        file("__proto__"),
        file(".env", "TOKEN=x"),
        { path: "link", kind: "other", size: 1, text: "l" },
      ]),
    ).toStrictEqual({ "a.js": "a", ".env": "TOKEN=x" });
  });
});

describe("withoutUnsaved", () => {
  it("保存しないパスを落とす", () => {
    expect(
      withoutUnsaved({ "a.js": "a", ".env": "x", "b/.yarnrc.yml": "y", "dist/a.js": "d" }),
    ).toStrictEqual({ "a.js": "a" });
  });
});

describe("filesToSave", () => {
  it("保存しないディレクトリの下のもの、シークレットのファイル、リンク、テキストとして読めないものを除く", () => {
    expect(
      filesToSave([
        file("a.js", "a"),
        file("dist/a.js"),
        file(".env.local"),
        file("big.bin", null, 2_000_000),
        { path: "link", kind: "other", size: 1, text: "l" },
      ]),
    ).toStrictEqual({ kind: "within", files: { "a.js": "a" } });
  });

  it("保存しないディレクトリの下のものは、上限に数えない", () => {
    const entries = Array.from({ length: SAVE_LIMIT.files + 1 }, (_, i) => file(`dist/${i}.js`));
    expect(filesToSave(entries).kind).toBe("within");
  });

  it.each([
    ["ファイルの数", Array.from({ length: SAVE_LIMIT.files + 1 }, (_, i) => file(`${i}.js`))],
    ["大きさの合計", [file("a.bin", null, SAVE_LIMIT.bytes), file("b.js", "b")]],
  ])("%s が上限を超えたら over-limit を返す", (_, entries) => {
    expect(filesToSave(entries)).toStrictEqual({ kind: "over-limit" });
  });

  it("上限ちょうどなら保存する", () => {
    expect(filesToSave([file("a.bin", null, SAVE_LIMIT.bytes)]).kind).toBe("within");
  });
});
