import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inkBackgroundSvg } from "./ink-background";

describe("inkBackgroundSvg", () => {
  const svg = inkBackgroundSvg();

  it("生成した SVG が、コミットした ink-background.svg と同じである", async () => {
    await expect(svg).toMatchFileSnapshot("./ink-background.svg");
  });

  it("画像として単独で読めるよう、SVG の名前空間を持つ", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it("mask の画像にはページの CSS が当たらないので、CSS 変数を参照しない", () => {
    expect(svg).not.toContain("var(");
  });

  it("同じ origin の URL を直接開いても動くものが無いよう、絵を描く要素だけを使う", () => {
    const allowed = [
      "svg",
      "style",
      "defs",
      "filter",
      "feTurbulence",
      "feColorMatrix",
      "feComposite",
      "feGaussianBlur",
      "radialGradient",
      "stop",
      "g",
      "path",
      "circle",
    ];
    const used = new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]));
    expect([...used].filter((name) => !allowed.includes(name!))).toStrictEqual([]);
  });

  it("属性に、イベントの処理と外の参照を持たない", () => {
    expect(svg).not.toMatch(/\son[a-z]+=|href=|@import|url\((?!#)/i);
  });

  it("gzip で 30 KiB 以下に収まる", () => {
    expect(gzipSync(svg).length).toBeLessThanOrEqual(30 * 1024);
  });

  it.each([
    ["class が違う", '<svg viewBox="0 0 1 1" aria-hidden="true" focusable="false">'],
    ["読み上げの属性が無い", '<svg class="ink-svg" viewBox="0 0 1 1">'],
  ])("開きタグの%sときは、壊れた SVG を作らずに例外を投げる", (_, svg) => {
    expect(() => inkBackgroundSvg({ svg, strokes: 0, paths: 0 })).toThrow(
      "inkSvg() の開きタグの形が変わった",
    );
  });
});
