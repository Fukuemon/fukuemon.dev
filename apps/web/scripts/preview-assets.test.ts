import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPreviewAssets, withNoindex } from "./preview-assets";

const HANDWRITTEN =
  "/*\n  X-Content-Type-Options: nosniff\n\n/_astro/*\n  Cache-Control: immutable\n";
const WITH_NOINDEX =
  "/*\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n\n/_astro/*\n  Cache-Control: immutable\n";
const NOINDEX = "/*\n  X-Robots-Tag: noindex\n";

describe("withNoindex", () => {
  it("既にある全てのパスの規則に noindex の行を足す", () => {
    expect(withNoindex(HANDWRITTEN)).toBe(WITH_NOINDEX);
  });

  it("全てのパスの規則が無いときは、先頭に作る", () => {
    expect(withNoindex("/_astro/*\n  Cache-Control: immutable\n")).toBe(
      `${NOINDEX}\n/_astro/*\n  Cache-Control: immutable\n`,
    );
  });

  it("空の _headers には規則だけを書く", () => {
    expect(withNoindex("")).toBe(NOINDEX);
  });
});

describe("buildPreviewAssets", () => {
  function dist(files: Record<string, string>): { dir: string; out: string } {
    const root = mkdtempSync(join(tmpdir(), "preview-assets-"));
    const dir = join(root, "dist");
    mkdirSync(dir);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return { dir, out: join(root, "dist-preview") };
  }

  it("複製の _headers の全てのパスの規則に noindex を足す", () => {
    const { dir, out } = dist({ "index.html": "<p>top</p>", _headers: HANDWRITTEN });
    buildPreviewAssets(dir, out);
    expect(readFileSync(join(out, "_headers"), "utf8")).toBe(WITH_NOINDEX);
  });

  it("_headers 以外のファイルをそのまま複製する", () => {
    const { dir, out } = dist({ "index.html": "<p>top</p>", _headers: HANDWRITTEN });
    buildPreviewAssets(dir, out);
    expect(readFileSync(join(out, "index.html"), "utf8")).toBe("<p>top</p>");
  });

  it("ビルドの出力の _headers は変えない", () => {
    const { dir, out } = dist({ "index.html": "<p>top</p>", _headers: HANDWRITTEN });
    buildPreviewAssets(dir, out);
    expect(readFileSync(join(dir, "_headers"), "utf8")).toBe(HANDWRITTEN);
  });

  it("_headers が無いときは、noindex の規則だけの _headers を作る", () => {
    const { dir, out } = dist({ "index.html": "<p>top</p>" });
    buildPreviewAssets(dir, out);
    expect(readFileSync(join(out, "_headers"), "utf8")).toBe(NOINDEX);
  });

  it("前の複製に残ったファイルを消してから複製する", () => {
    const { dir, out } = dist({ "index.html": "<p>top</p>" });
    mkdirSync(out);
    writeFileSync(join(out, "stale.html"), "old");
    buildPreviewAssets(dir, out);
    expect(existsSync(join(out, "stale.html"))).toBe(false);
  });

  it("ビルドの出力が無いときは失敗する", () => {
    const { dir, out } = dist({});
    expect(() => buildPreviewAssets(dir, out)).toThrow(/build/);
  });
});
