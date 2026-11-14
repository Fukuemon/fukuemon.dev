import type { FileContents } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import { SAVE_LIMIT, isUnsaved, restartFiles, saveFiles } from "./save-rules";

const file = (path: string, text: string | null = "x", size = 1): FileContents => ({
  path,
  kind: "file",
  size,
  text,
});

describe("isUnsaved", () => {
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
  ])("%s は保存しない", (path) => {
    expect(isUnsaved(path)).toBe(true);
  });

  it.each(["index.js", "build/index.js", "src/env.ts", ".environment", "a/.envrc", "distance.js"])(
    "%s は保存する",
    (path) => {
      expect(isUnsaved(path)).toBe(false);
    },
  );
});

describe("restartFiles", () => {
  it("テキストとして読めないファイルと、規則に合わないパスを除き、保存しないファイルとリンクは残す", () => {
    expect(
      restartFiles([
        file("a.js", "a"),
        file("big.bin", null, 2_000_000),
        file("__proto__"),
        file(".env", "TOKEN=x"),
        { path: "link", kind: "other", size: 1, text: "l" },
      ]),
    ).toStrictEqual({ "a.js": "a", ".env": "TOKEN=x", link: "l" });
  });
});

describe("saveFiles", () => {
  it("保存しないディレクトリの下のもの、シークレットのファイル、リンク、テキストとして読めないものを除く", () => {
    expect(
      saveFiles([
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
    expect(saveFiles(entries).kind).toBe("within");
  });

  it.each([
    ["ファイルの数", Array.from({ length: SAVE_LIMIT.files + 1 }, (_, i) => file(`${i}.js`))],
    ["大きさの合計", [file("a.bin", null, SAVE_LIMIT.bytes), file("b.js", "b")]],
  ])("%s が上限を超えたら over-limit を返す", (_, entries) => {
    expect(saveFiles(entries)).toStrictEqual({ kind: "over-limit" });
  });

  it("上限ちょうどなら保存する", () => {
    expect(saveFiles([file("a.bin", null, SAVE_LIMIT.bytes)]).kind).toBe("within");
  });
});
