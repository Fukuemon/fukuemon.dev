import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  articleOgImage,
  ogText,
  parseFontSlices,
  renderOgImage,
  resolveColors,
  slicesFor,
} from "./og-image";

describe("resolveColors", () => {
  it("var() を辿り、ライトのテーマの最初の宣言の値を返す", () => {
    const css = `:root { --p-a: navy; --p-b: ivory; --fd-color-text: var(--p-a); --fd-color-surface: var(--p-b); }
      @media (prefers-color-scheme: dark) { :root { --fd-color-text: var(--p-b); } }`;
    expect(resolveColors(css)).toEqual({ surface: "ivory", text: "navy" });
  });

  it("宣言が無いとき、名前を添えて失敗する", () => {
    expect(() => resolveColors(":root { --fd-color-text: black; }")).toThrow("--fd-color-surface");
  });

  it("参照が循環しているとき、失敗する", () => {
    const css = ":root { --fd-color-surface: var(--fd-color-surface); --fd-color-text: black; }";
    expect(() => resolveColors(css)).toThrow("循環");
  });
});

describe("parseFontSlices と slicesFor", () => {
  const css = `@font-face { src: url(./files/a.woff2) format('woff2'), url(./files/a.woff) format('woff'); unicode-range: U+0020-007f; }
    @font-face { src: url(./files/b.woff2) format('woff2'), url(./files/b.woff) format('woff'); unicode-range: U+3042,U+3044-3046; }`;

  it("分割ごとの woff と範囲を読む", () => {
    expect(parseFontSlices(css)).toEqual([
      { file: "a.woff", ranges: [[0x20, 0x7f]] },
      {
        file: "b.woff",
        ranges: [
          [0x3042, 0x3042],
          [0x3044, 0x3046],
        ],
      },
    ]);
  });

  it("woff が無い @font-face は失敗する", () => {
    expect(() => parseFontSlices("@font-face { unicode-range: U+20; }")).toThrow("woff");
  });

  it("字を含む分割だけを選ぶ", () => {
    const slices = parseFontSlices(css);
    expect(slicesFor("abc", slices).map((s) => s.file)).toEqual(["a.woff"]);
    expect(slicesFor("い", slices).map((s) => s.file)).toEqual(["b.woff"]);
  });
});

describe("パスと字", () => {
  it("記事の画像のパスは記事の id から作る", () => {
    expect(articleOgImage("article-elements/intro")).toBe(
      "/og/articles/article-elements/intro.png",
    );
  });

  it("共通の画像はサイトの名前だけを描く", () => {
    expect(ogText()).toBe("fukuemon.dev");
    expect(ogText("題")).toBe("題fukuemon.dev");
  });
});

describe("renderOgImage", () => {
  it("1200×630 の PNG を描く", async () => {
    const fontCss = createRequire(import.meta.url).resolve("@fontsource/zen-old-mincho/600.css");
    const slices = slicesFor(ogText("記事の題"), parseFontSlices(readFileSync(fontCss, "utf8")));
    const fonts = slices.map((s) => {
      const b = readFileSync(join(dirname(fontCss), "files", s.file));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    });
    const inkSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="black"/></svg>';
    const png = await renderOgImage("記事の題", {
      colors: { surface: "white", text: "black" },
      inkSvg,
      fonts,
    });
    const view = new DataView(png.buffer, png.byteOffset);
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  });
});
