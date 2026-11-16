import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const SITE = "fukuemon.dev";

/** 画像を塗るトークンの色 */
export type OgColors = { surface: string; text: string };

/** 書体の分割の 1 つ。unicode-range の範囲と、Fontsource の files/ の下の woff のファイル名 */
export type FontSlice = { ranges: [number, number][]; file: string };

/** トップと一覧のページの共通の画像のパス */
export const DEFAULT_OG_IMAGE = "/og/default.png";

/** 記事の画像のパス。記事の id は、記事のページのパスと同じものを使う */
export function articleOgImage(id: string): string {
  return `/og/articles/${id}.png`;
}

/**
 * tokens.gen.css から、ライトのテーマの面と文字の色を、var() を辿って色の値まで解決する。
 * ダークの宣言は後ろの media と属性のセレクタの中にあるので、名前ごとに最初の宣言だけを読む。
 */
export function resolveColors(css: string): OgColors {
  const decls = new Map<string, string>();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    if (!decls.has(m[1]!)) decls.set(m[1]!, m[2]!.trim());
  const resolve = (name: string, seen: Set<string>): string => {
    const value = decls.get(name);
    if (value === undefined) throw new Error(`${name} が tokens.gen.css に無い`);
    if (seen.has(name)) throw new Error(`${name} の参照が循環している`);
    seen.add(name);
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    return ref ? resolve(ref[1]!, seen) : value;
  };
  return {
    surface: resolve("--fd-color-surface", new Set()),
    text: resolve("--fd-color-text", new Set()),
  };
}

/** Fontsource の 1 ウェイトの CSS から、分割ごとの unicode-range と woff のファイル名を読む。satori は woff2 を読めない */
export function parseFontSlices(css: string): FontSlice[] {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
    const file = /url\(\.\/files\/([^)]+\.woff)\)\s*format\('woff'\)/.exec(body!)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body!)?.[1];
    if (!file || !range) throw new Error("@font-face に woff のファイルか unicode-range が無い");
    const ranges = range.split(",").map((r): [number, number] => {
      const [from, to = from] = r.trim().replace(/^U\+/i, "").split("-");
      return [parseInt(from!, 16), parseInt(to!, 16)];
    });
    return { ranges, file };
  });
}

/** 画像に描く字を含む分割だけを選ぶ。和文の書体は 1 ウェイトで 100 を超える分割があり、全てを読むとビルドが遅くなる */
export function slicesFor(text: string, slices: FontSlice[]): FontSlice[] {
  const codes = [...new Set(text)].map((c) => c.codePointAt(0)!);
  return slices.filter((s) => codes.some((c) => s.ranges.some(([a, b]) => c >= a && c <= b)));
}

/** 題が無いときは、共通の画像としてサイトの名前を大きく描く */
export function ogText(title?: string): string {
  return title === undefined ? SITE : `${title}${SITE}`;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children },
});

/** 墨の絵を、背景の絵と同じく文字の色で塗り、16% の濃さで敷く（ADR-0082） */
function inkImage(inkSvg: string, colors: OgColors): Node {
  const tinted = inkSvg
    .replaceAll("black", colors.text)
    .replace("<svg ", `<svg opacity="0.16" width="${OG_WIDTH}" height="${OG_HEIGHT}" `);
  return {
    type: "img",
    props: {
      src: `data:image/svg+xml;base64,${Buffer.from(tinted).toString("base64")}`,
      width: OG_WIDTH,
      height: OG_HEIGHT,
      style: { position: "absolute", inset: 0 },
    },
  };
}

function layout(title: string | undefined, colors: OgColors, inkSvg: string, family: string): Node {
  return h(
    "div",
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: "flex",
      position: "relative",
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: family,
      fontWeight: 600,
    },
    inkImage(inkSvg, colors),
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        padding: "72px 88px 64px",
      },
      h("div", { fontSize: title === undefined ? 88 : 64, lineHeight: 1.4 }, title ?? SITE),
      h(
        "div",
        {
          display: "flex",
          justifyContent: "flex-end",
          height: 84,
          paddingTop: 20,
          borderTop: `4px solid ${colors.text}`,
          fontSize: 36,
        },
        title === undefined ? "" : SITE,
      ),
    ),
  );
}

/**
 * 1200×630 の PNG を描く。title を省くと、トップと一覧のページの共通の画像になる。
 * fonts は、ogText() の字を含む Zen Old Mincho 600 の分割の woff を渡す。
 * satori は同じ名前の書体の間で字を探し直さないので、分割ごとに名前を分け、font-family に全てを並べる。
 */
export async function renderOgImage(
  title: string | undefined,
  { colors, inkSvg, fonts }: { colors: OgColors; inkSvg: string; fonts: ArrayBuffer[] },
): Promise<Uint8Array> {
  const names = fonts.map((_, i) => `zen-old-mincho-${i}`);
  const svg = await satori(layout(title, colors, inkSvg, names.join(", ")) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts.map((data, i) => ({ name: names[i]!, data, weight: 600, style: "normal" })),
  });
  return new Resvg(svg).render().asPng();
}
