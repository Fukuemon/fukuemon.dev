import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashedUrl,
  htmlChars,
  parseFaces,
  parseFontRules,
  parseRanges,
  styleTexts,
  subsetFonts,
} from "./subset-fonts";

const subsetFont = vi.hoisted(() =>
  vi.fn(async (_src: Uint8Array, text: string) => Buffer.from(`subset:${text}`)),
);
vi.mock("subset-font", () => ({ default: subsetFont }));

const FAMILY = "Zen Old Mincho";
const CSS =
  '@font-face{font-family:Zen Old Mincho;font-weight:400;src:url(/_astro/zen-old-mincho-2-400-normal.BODdGfVy.woff2)format("woff2"),url(/_astro/zen-old-mincho-2-400-normal.Cg5S6LfO.woff)format("woff");unicode-range:U+3001-3003,U+FF01}' +
  '@font-face{font-family:STIX Two Text Variable;src:url(/_astro/stix-two-text-latin-wght-normal.Ab3_xY-9.woff2)format("woff2");unicode-range:U+0000-00FF}';
const RULE = `.font-heading{font-family:"Zen Old Mincho", sans-serif}`;
const heading = (text: string) => `<h1 class="font-heading">${text}</h1>`;
const sorted = (chars: Set<string>) => [...chars].sort().join("");

describe("@font-face の読み取り", () => {
  it("指定の書体の woff2 と unicode-range だけを取り出す", () => {
    expect(parseFaces(CSS, FAMILY)).toStrictEqual([
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
    expect(parseFaces(quoted, FAMILY)).toHaveLength(1);
  });

  it("範囲と単独の字を読み分ける", () => {
    expect(parseRanges("U+0-FF, U+131")).toStrictEqual([
      [0, 0xff],
      [0x131, 0x131],
    ]);
  });

  it("ワイルドカードを、下端を 0、上端を F にして読む", () => {
    expect(parseRanges("U+??, U+1F??")).toStrictEqual([
      [0, 0xff],
      [0x1f00, 0x1fff],
    ]);
  });

  it("読めない値のとき、ビルドを止める", () => {
    expect(() => parseRanges("U+zz")).toThrow("読めない");
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

describe("書体を当てるセレクタの読み取り", () => {
  it("書体を font-family に持つ規則のクラスを集める", () => {
    const css = `${RULE}.text-sm{font-size:1rem}.other{font-family:sans-serif}`;
    expect(parseFontRules(css, FAMILY)).toStrictEqual({
      classes: new Set(["font-heading"]),
      unresolved: [],
    });
  });

  it("@media の中のバリアントと、擬似要素のクラスのエスケープを外す", () => {
    const css = `@media (min-width:48rem){.md\\:font-heading{font-family:"Zen Old Mincho"}}.placeholder\\:font-heading::placeholder{font-family:"Zen Old Mincho"}`;
    expect(parseFontRules(css, FAMILY)).toStrictEqual({
      classes: new Set(["md:font-heading", "placeholder:font-heading"]),
      unresolved: [],
    });
  });

  it("@font-face は規則に数えない", () => {
    expect(parseFontRules('@font-face{font-family:"Zen Old Mincho"}', FAMILY)).toStrictEqual({
      classes: new Set(),
      unresolved: [],
    });
  });

  it("@charset の直後の規則も読む", () => {
    expect(parseFontRules(`@charset "UTF-8";${RULE}`, FAMILY).classes).toStrictEqual(
      new Set(["font-heading"]),
    );
  });

  it("クラス 1 つでは表せないセレクタは、特定できないものとして返す", () => {
    const css = `.prose h2,h1{font-family:"Zen Old Mincho"}`;
    expect(parseFontRules(css, FAMILY)).toStrictEqual({
      classes: new Set(),
      unresolved: [".prose h2", "h1"],
    });
  });

  it.each([
    [
      "変数を参照する規則",
      `:root{--font-heading:"Zen Old Mincho",sans-serif}.a{font-family:var(--font-heading)}`,
    ],
    ["2 番目以降", `.a{font-family:"STIX Two","Zen Old Mincho"}`],
    ["ショートハンド", `.a{font:600 1rem "Zen Old Mincho"}`],
  ])("書体を先頭に書かない規則（%s）は、特定できないものとして返す", (_, css) => {
    expect(parseFontRules(css, FAMILY).unresolved).toHaveLength(1);
  });

  it("書体を変数に宣言するだけで、どこからも参照しないときは、規則に数えない", () => {
    const css = `:root{--font-heading:"Zen Old Mincho",sans-serif;--x:1}${RULE}`;
    expect(parseFontRules(css, FAMILY)).toStrictEqual({
      classes: new Set(["font-heading"]),
      unresolved: [],
    });
  });

  it("HTML に埋め込んだ style の中身を取り出す", () => {
    expect(styleTexts(`<style>${RULE}</style><p>a</p>`)).toStrictEqual([RULE]);
  });
});

describe("書体を当てる要素の字", () => {
  const options = { classes: new Set(["font-heading", "md:font-heading"]), family: FAMILY };

  it("クラスを持つ要素の字を集め、ほかの要素の字は集めない", () => {
    expect(sorted(htmlChars(`${heading("あい")}<p>うえ</p>`, options))).toBe("あい");
  });

  it("子孫の字も集める", () => {
    const html = `<h2 class="font-heading">あ<span>い<b>う</b></span></h2>`;
    expect(sorted(htmlChars(html, options))).toBe("あいう");
  });

  it("バリアントのクラスを持つ要素の字も集める", () => {
    expect(sorted(htmlChars(`<p class="x md:font-heading">あ</p>`, options))).toBe("あ");
  });

  it("placeholder、value、alt の字を集める", () => {
    const html = `<input class="font-heading" placeholder="あ" value="い"><img class="font-heading" alt="う">`;
    expect(sorted(htmlChars(html, options))).toBe("あいう");
  });

  it("クラスを持たない要素の placeholder は集めない", () => {
    expect(sorted(htmlChars(`<input placeholder="あ">`, options))).toBe("");
  });

  it("style 属性に書体を持つ要素の字を集める", () => {
    expect(sorted(htmlChars(`<p style="font-family:'Zen Old Mincho'">あ</p>`, options))).toBe("あ");
  });

  it("template の中身の字を集める", () => {
    const html = `<h1 class="font-heading"><template>あ</template></h1>`;
    expect(sorted(htmlChars(html, options))).toBe("あ");
  });

  it("script は U+2000 から上の字だけを集める", () => {
    const html = `<div class="font-heading"><script>const a="Aあ…"</script>う</div>`;
    expect(sorted(htmlChars(html, options))).toBe("…あう");
  });

  it("style の字は集めない", () => {
    expect(sorted(htmlChars(`<div class="font-heading"><style>あ</style></div>`, options))).toBe(
      "",
    );
  });

  it("every のとき、全ての要素の字を集める", () => {
    expect(sorted(htmlChars(`${heading("あ")}<p>い</p>`, { ...options, every: true }))).toBe(
      "あい",
    );
  });
});

describe("ビルド後の作り直し", () => {
  let dir = "";
  const warn = vi.fn();
  afterEach(async () => {
    subsetFont.mockClear();
    warn.mockClear();
    await rm(dir, { recursive: true, force: true });
  });

  const face = (name: string, range: string) =>
    `@font-face{font-family:Zen Old Mincho;src:url(/_astro/${name}.AAAAAAAA.woff2)format("woff2");unicode-range:${range}}`;

  interface Build {
    html?: string;
    css?: string;
    rule?: string;
    js?: string;
    pageCss?: string;
    extraFile?: string;
  }

  async function build({
    html = "",
    css = "",
    rule = RULE,
    js = "",
    pageCss = "",
    extraFile = "",
  }: Build) {
    dir = await mkdtemp(join(tmpdir(), "subset-fonts-"));
    await mkdir(join(dir, "_astro"));
    await writeFile(join(dir, "index.html"), html);
    await writeFile(join(dir, "_astro/site.css"), css + rule);
    await writeFile(join(dir, "_astro/page.css"), pageCss);
    await writeFile(join(dir, "_astro/app.js"), js);
    await writeFile(join(dir, "_astro/a.AAAAAAAA.woff2"), "a");
    await writeFile(join(dir, "_astro/b.AAAAAAAA.woff2"), "b");
    if (extraFile !== "") await writeFile(join(dir, "_astro", extraFile), "x");
    const hook = subsetFonts(FAMILY).hooks["astro:build:done"]!;
    await hook({ dir: pathToFileURL(`${dir}/`), logger: { info: vi.fn(), warn } } as never);
  }

  const texts = () => subsetFont.mock.calls.map(([, text]) => text);
  const renamed = hashedUrl("/_astro/a.AAAAAAAA.woff2", Buffer.from("subset:あ")).replace(
    "/_astro/",
    "",
  );
  const both = face("a", "U+3042") + face("b", "U+3044");

  it("使う字を含むスライスだけを、使う字で作り直す", async () => {
    await build({ html: heading("あ"), css: both });

    expect(texts()).toStrictEqual(["あ"]);
  });

  it("作り直したスライスを、中身の hash の名前で置く", async () => {
    await build({ html: heading("あ"), css: both });

    expect((await readdir(join(dir, "_astro"))).sort()).toStrictEqual(
      ["app.js", "b.AAAAAAAA.woff2", "page.css", "site.css", renamed].sort(),
    );
  });

  it("CSS の参照を、作り直した名前に差し替える", async () => {
    await build({ html: heading("あ"), css: both });

    const next = face("a", "U+3042").replace("a.AAAAAAAA.woff2", renamed);
    expect(await readFile(join(dir, "_astro/site.css"), "utf8")).toBe(
      next + face("b", "U+3044") + RULE,
    );
  });

  it("末尾が同じだけの別の URL は、書き換えない", async () => {
    const other = ".x{src:url(/other/_astro/a.AAAAAAAA.woff2)}";
    await build({ html: heading("あ"), css: face("a", "U+3042"), pageCss: other });

    expect(await readFile(join(dir, "_astro/page.css"), "utf8")).toBe(other);
  });

  it("複数の CSS に同じスライスがあっても、1 回だけ作り直す", async () => {
    await build({ html: heading("あ"), css: face("a", "U+3042"), pageCss: face("a", "U+3042") });

    expect(subsetFont).toHaveBeenCalledTimes(1);
  });

  it("JS は U+2000 から上の字だけを使う字に数える", async () => {
    await build({ html: "<p></p>", css: face("a", "U+0041,U+3042"), js: 'const a="Aあ"' });

    expect(texts()).toStrictEqual(["あ"]);
  });

  it("ワイルドカードのスライスにも、使う字を渡す", async () => {
    await build({ html: heading("Aあ—"), css: face("a", "U+??,U+2000-206F") });

    expect(texts()).toStrictEqual(["A—"]);
  });

  it("使う字がないスライスは、そのまま残す", async () => {
    await build({ html: "<p>z</p>", css: face("a", "U+3042") });

    expect(await readdir(join(dir, "_astro"))).toContain("a.AAAAAAAA.woff2");
  });

  it("書体を当てない要素の字では、スライスを作り直さない", async () => {
    await build({ html: `${heading("あ")}<p>い</p>`, css: both });

    expect(texts()).toStrictEqual(["あ"]);
  });

  it("HTML に埋め込んだ style の規則で書体を当てる要素の字も使う", async () => {
    await build({ html: `<style>${RULE}</style>${heading("あ")}`, css: both, rule: "" });

    expect(texts()).toStrictEqual(["あ"]);
  });

  it("CSS の content に書いた字も使う", async () => {
    await build({ html: heading("あ"), css: both, rule: `${RULE}.x::before{content:"い"}` });

    expect(texts()).toStrictEqual(["あ", "い"]);
  });

  it("書体を当てる要素を特定できないときは、全ての HTML の字を使う", async () => {
    await build({
      html: `${heading("あ")}<p>い</p>`,
      css: face("a", "U+3042,U+3044"),
      rule: `h2{font-family:"Zen Old Mincho"}`,
    });

    expect(texts()).toStrictEqual(["あい"]);
  });

  it("書体を当てる要素を特定できないとき、警告を 1 回だけ出す", async () => {
    await build({
      html: heading("あ"),
      css: face("a", "U+3042"),
      rule: `h2{font-family:"Zen Old Mincho"}`,
      pageCss: `h2{font-family:"Zen Old Mincho"}`,
    });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("対象の書体の @font-face が CSS にないとき、ビルドを止める", async () => {
    await expect(build({ html: heading("あ") })).rejects.toThrow("@font-face");
  });

  it("書体を当てる規則が CSS にないとき、ビルドを止める", async () => {
    await expect(build({ html: heading("あ"), css: both, rule: "" })).rejects.toThrow("規則");
  });

  it("名前の hash を差し替えられないとき、ビルドを止める", async () => {
    const odd = face("a", "U+3042").replace("a.AAAAAAAA.woff2", "odd.woff2");
    await expect(build({ html: heading("あ"), css: odd, extraFile: "odd.woff2" })).rejects.toThrow(
      "差し替えられない",
    );
  });

  it("書体のファイルの URL が出力の外を指すとき、ビルドを止める", async () => {
    const outside = face("a", "U+3042").replace("/_astro/a.AAAAAAAA.woff2", "/../x.AAAAAAAA.woff2");
    await expect(build({ html: heading("あ"), css: outside })).rejects.toThrow("の外を指している");
  });

  it("使う字のないスライスの URL が出力の外を指すときも、何も書き換えずにビルドを止める", async () => {
    const outside = face("b", "U+3044").replace("/_astro/b.AAAAAAAA.woff2", "/../x.AAAAAAAA.woff2");
    await expect(
      build({ html: heading("あ"), css: face("a", "U+3042") + outside }),
    ).rejects.toThrow("の外を指している");
    expect(subsetFont).not.toHaveBeenCalled();
  });

  it.each([
    ["相対パス", "_astro/a.AAAAAAAA.woff2"],
    ["プロトコル相対", "//cdn.example.com/a.AAAAAAAA.woff2"],
  ])(
    "書体のファイルの URL が / で始まる絶対パスでないとき（%s）、ビルドを止める",
    async (_, url) => {
      const bad = face("a", "U+3042").replace("/_astro/a.AAAAAAAA.woff2", url);
      await expect(build({ html: heading("あ"), css: bad })).rejects.toThrow("の外を指している");
    },
  );
});
