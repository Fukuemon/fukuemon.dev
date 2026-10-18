import { describe, expect, it } from "vitest";
import { parseFaces, parseRanges, rename } from "./subset-fonts";

const CSS =
  '@font-face{font-family:Zen Old Mincho;font-weight:400;src:url(/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2)format("woff2"),url(/_astro/zen-old-mincho-2-400-normal.Cg5S6LfO.woff)format("woff");unicode-range:U+3001-3003,U+FF01}' +
  '@font-face{font-family:EB Garamond Variable;src:url(/_astro/eb-garamond-latin-wght-normal.Ab3_xY-9.woff2)format("woff2");unicode-range:U+0000-00FF}';

describe("@font-face の読み取り", () => {
  it("指定の書体の woff2 と unicode-range だけを取り出す", () => {
    expect(parseFaces(CSS, "Zen Old Mincho")).toStrictEqual([
      {
        url: "/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2",
        ranges: [
          [0x3001, 0x3003],
          [0xff01, 0xff01],
        ],
      },
    ]);
  });

  it("引用符で囲んだ書体名も読む", () => {
    const quoted = CSS.replace("font-family:Zen Old Mincho", 'font-family:"Zen Old Mincho"');
    expect(parseFaces(quoted, "Zen Old Mincho")).toHaveLength(1);
  });

  it("範囲と単独の字を読み分ける", () => {
    expect(parseRanges("U+0-FF, U+131")).toStrictEqual([
      [0, 0xff],
      [0x131, 0x131],
    ]);
  });
});

describe("名前の付け直し", () => {
  it("Vite の hash を中身の hash に差し替える", () => {
    const url = rename(
      "/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2",
      new Uint8Array([1, 2, 3]),
    );
    expect(url).toMatch(/^\/_astro\/zen-old-mincho-2-400-normal\.[\w-]{8}\.woff2$/);
    expect(url).not.toContain("BODdGfVy");
  });

  it("中身が変われば名前も変わる", () => {
    const url = "/_astro/a.BODdGfVy.woff2";
    expect(rename(url, new Uint8Array([1]))).not.toBe(rename(url, new Uint8Array([2])));
  });
});
