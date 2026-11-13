import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFaces, parseRanges, hashedUrl, subsetFonts } from "./subset-fonts";

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
    const url = hashedUrl(
      "/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2",
      new Uint8Array([1, 2, 3]),
    );
    expect(url).toMatch(/^\/_astro\/zen-old-mincho-2-400-normal\.[\w-]{8}\.woff2$/);
    expect(url).not.toContain("BODdGfVy");
  });

  it("中身が変われば名前も変わる", () => {
    const url = "/_astro/a.BODdGfVy.woff2";
    expect(hashedUrl(url, new Uint8Array([1]))).not.toBe(hashedUrl(url, new Uint8Array([2])));
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

  async function build(html: string, css: string, js = "", css2 = "", extra = "") {
    dir = await mkdtemp(join(tmpdir(), "subset-fonts-"));
    await mkdir(join(dir, "_astro"));
    await writeFile(join(dir, "index.html"), html);
    await writeFile(join(dir, "_astro/site.css"), css);
    await writeFile(join(dir, "_astro/page.css"), css2);
    await writeFile(join(dir, "_astro/app.js"), js);
    await writeFile(join(dir, "_astro/a.AAAAAAAA.woff2"), "a");
    await writeFile(join(dir, "_astro/b.AAAAAAAA.woff2"), "b");
    if (extra !== "") await writeFile(join(dir, "_astro", extra), "x");
    const hook = subsetFonts("Zen Old Mincho").hooks["astro:build:done"]!;
    await hook({ dir: pathToFileURL(`${dir}/`), logger: { info: vi.fn() } } as never);
  }

  const renamed = hashedUrl("/_astro/a.AAAAAAAA.woff2", Buffer.from("subset:あ")).replace(
    "/_astro/",
    "",
  );

  it("使う字を含むスライスだけを、使う字で作り直す", async () => {
    await build("<h1>あ</h1>", face("a", "U+3042") + face("b", "U+3044"));

    expect(subsetFont.mock.calls.map(([, text]) => text)).toStrictEqual(["あ"]);
  });

  it("作り直したスライスを、中身の hash の名前で置く", async () => {
    await build("<h1>あ</h1>", face("a", "U+3042") + face("b", "U+3044"));

    expect((await readdir(join(dir, "_astro"))).sort()).toStrictEqual(
      ["app.js", "b.AAAAAAAA.woff2", "page.css", "site.css", renamed].sort(),
    );
  });

  it("CSS の参照を、作り直した名前に差し替える", async () => {
    await build("<h1>あ</h1>", face("a", "U+3042") + face("b", "U+3044"));

    const next = face("a", "U+3042").replace("a.AAAAAAAA.woff2", renamed);
    expect(await readFile(join(dir, "_astro/site.css"), "utf8")).toBe(next + face("b", "U+3044"));
  });

  it("複数の CSS に同じスライスがあっても、1 回だけ作り直す", async () => {
    await build("<h1>あ</h1>", face("a", "U+3042"), "", face("a", "U+3042"));

    expect(subsetFont).toHaveBeenCalledTimes(1);
  });

  it("JS は U+2000 から上の字だけを使う字に数える", async () => {
    await build("<p></p>", face("a", "U+0041,U+3042"), 'const a="Aあ"');

    expect(subsetFont).toHaveBeenCalledWith(expect.anything(), "あ", { targetFormat: "woff2" });
  });

  it("対象の書体の @font-face が CSS にないとき、ビルドを止める", async () => {
    await expect(build("<h1>あ</h1>", "body{}")).rejects.toThrow("見つからない");
  });

  it("名前の hash を差し替えられないとき、ビルドを止める", async () => {
    const odd = face("a", "U+3042").replace("a.AAAAAAAA.woff2", "odd.woff2");
    await expect(build("<h1>あ</h1>", odd, "", "", "odd.woff2")).rejects.toThrow(
      "差し替えられない",
    );
  });

  it("使う字がないスライスは、そのまま残す", async () => {
    await build("<p>z</p>", face("a", "U+3042"));

    expect(subsetFont).not.toHaveBeenCalled();
    expect(await readdir(join(dir, "_astro"))).toContain("a.AAAAAAAA.woff2");
  });
});
