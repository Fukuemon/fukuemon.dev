import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPreviewAssets, withNoindex } from "./preview-assets";

const HANDWRITTEN = "/*\n  X-Content-Type-Options: nosniff\n";

describe("withNoindex", () => {
  it("全てのパスへ noindex を返す規則を末尾に足す", () => {
    expect(withNoindex(HANDWRITTEN)).toBe(`${HANDWRITTEN}\n/*\n  X-Robots-Tag: noindex\n`);
  });

  it("既に noindex があるときは変えない", () => {
    const once = withNoindex(HANDWRITTEN);
    expect(withNoindex(once)).toBe(once);
  });

  it("空の _headers には規則だけを書く", () => {
    expect(withNoindex("")).toBe("/*\n  X-Robots-Tag: noindex\n");
  });
});

describe("buildPreviewAssets", () => {
  function dist(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "preview-assets-"));
    const dir = join(root, "dist");
    mkdirSync(dir);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  }

  it("複製の _headers に noindex を足し、ビルドの出力の _headers は変えない", () => {
    const dir = dist({ "index.html": "<p>top</p>", _headers: HANDWRITTEN });
    const out = join(dir, "..", "dist-preview");
    buildPreviewAssets(dir, out);
    expect(readFileSync(join(out, "_headers"), "utf8")).toContain("X-Robots-Tag: noindex");
    expect(readFileSync(join(out, "index.html"), "utf8")).toBe("<p>top</p>");
    expect(readFileSync(join(dir, "_headers"), "utf8")).toBe(HANDWRITTEN);
  });

  it("前の複製に残ったファイルを消してから複製する", () => {
    const dir = dist({ "index.html": "<p>top</p>" });
    const out = join(dir, "..", "dist-preview");
    mkdirSync(out);
    writeFileSync(join(out, "stale.html"), "old");
    buildPreviewAssets(dir, out);
    expect(() => readFileSync(join(out, "stale.html"))).toThrow();
    expect(readFileSync(join(out, "_headers"), "utf8")).toBe("/*\n  X-Robots-Tag: noindex\n");
  });

  it("ビルドの出力が無いときは、複製せずに失敗する", () => {
    const dir = dist({});
    expect(() => buildPreviewAssets(dir, join(dir, "..", "dist-preview"))).toThrow(/build/);
  });
});
