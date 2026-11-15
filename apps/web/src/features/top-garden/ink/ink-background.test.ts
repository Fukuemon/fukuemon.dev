import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inkBackgroundSvg } from "./ink-background";

describe("inkBackgroundSvg", () => {
  const svg = inkBackgroundSvg();

  it("書き出した ink-background.svg と同じである。生成のコードを変えたら -u で書き出し直す", async () => {
    await expect(svg).toMatchFileSnapshot("./ink-background.svg");
  });

  it("画像として単独で読めるよう、名前空間を持ち、ページの CSS 変数を参照しない", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toContain("var(");
  });

  it("同じ origin の URL を直接開いたときに動くものを持たない", () => {
    expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+=|href=/i);
  });

  it("gzip で 30 KiB 以下に収まる", () => {
    expect(gzipSync(svg).length).toBeLessThanOrEqual(30 * 1024);
  });

  it("開きタグの形が想定と違うときは、黙って壊れた SVG を作らずに例外を投げる", () => {
    expect(() => inkBackgroundSvg({ svg: "<svg>", strokes: 0, paths: 0 })).toThrow();
  });
});
