import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFaces, parseRanges, rename, subsetFonts } from "./subset-fonts";

const subsetFont = vi.hoisted(() =>
  vi.fn(async (_src: Uint8Array, text: string) => Buffer.from(`subset:${text}`)),
);
vi.mock("subset-font", () => ({ default: subsetFont }));

const CSS =
  '@font-face{font-family:Zen Old Mincho;font-weight:400;src:url(/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2)format("woff2"),url(/_astro/zen-old-mincho-2-400-normal.Cg5S6LfO.woff)format("woff");unicode-range:U+3001-3003,U+FF01}' +
  '@font-face{font-family:STIX Two Text Variable;src:url(/_astro/stix-two-text-latin-wght-normal.Ab3_xY-9.woff2)format("woff2");unicode-range:U+0000-00FF}';

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

describe("ビルド後の作り直し", () => {
  let dir = "";
  afterEach(async () => {
    subsetFont.mockClear();
    await rm(dir, { recursive: true, force: true });
  });

  const face = (name: string, range: string) =>
    `@font-face{font-family:Zen Old Mincho;src:url(/_astro/${name}.AAAAAAAA.woff2)format("woff2");unicode-range:${range}}`;

  async function build(html: string, css: string, js = "") {
    dir = await mkdtemp(join(tmpdir(), "subset-fonts-"));
    await mkdir(join(dir, "_astro"));
    await writeFile(join(dir, "index.html"), html);
    await writeFile(join(dir, "_astro/site.css"), css);
    await writeFile(join(dir, "_astro/app.js"), js);
    await writeFile(join(dir, "_astro/a.AAAAAAAA.woff2"), "a");
    await writeFile(join(dir, "_astro/b.AAAAAAAA.woff2"), "b");
    const hook = subsetFonts("Zen Old Mincho").hooks["astro:build:done"]!;
    await hook({ dir: pathToFileURL(`${dir}/`), logger: { info: vi.fn() } } as never);
  }

  it("使う字を含むスライスだけを作り直し、名前と CSS の参照を差し替える", async () => {
    const css = face("a", "U+3042") + face("b", "U+3044");
    await build("<h1>あ</h1>", css);

    expect(subsetFont).toHaveBeenCalledTimes(1);
    expect(subsetFont.mock.calls[0]![1]).toBe("あ");
    const files = await readdir(join(dir, "_astro"));
    expect(files).not.toContain("a.AAAAAAAA.woff2");
    expect(files).toContain("b.AAAAAAAA.woff2");
    const next = await readFile(join(dir, "_astro/site.css"), "utf8");
    expect(next).not.toContain("a.AAAAAAAA.woff2");
    expect(next).toContain("b.AAAAAAAA.woff2");
  });

  it("JS は U+2000 から上の字だけを使う字に数える", async () => {
    await build("<p></p>", face("a", "U+0041,U+3042"), 'const a="Aあ"');

    expect(subsetFont.mock.calls[0]![1]).toBe("あ");
  });

  it("使う字がないスライスは、そのまま残す", async () => {
    await build("<p>z</p>", face("a", "U+3042"));

    expect(subsetFont).not.toHaveBeenCalled();
    expect(await readdir(join(dir, "_astro"))).toContain("a.AAAAAAAA.woff2");
  });
});
