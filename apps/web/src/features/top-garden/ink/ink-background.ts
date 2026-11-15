import { inkSvg, type InkSvg } from "./ink-svg";

/** 線の色と filter の掛け方。mask の画像にはページの CSS が当たらないので、SVG の中に持つ */
const STYLE =
  "<style>path{fill:none;stroke:black;stroke-linecap:round;stroke-linejoin:round}" +
  ".far{filter:url(#f-wash)}.mid,.near .lines{filter:url(#f-dry)}.pine{fill:url(#g-pine);opacity:.2}</style>";

/**
 * 庭を出さないときのトップの背景に、CSS の `mask-image` で掛ける墨の絵の SVG を作る。
 * イントロの墨の絵と同じ線で、色を持たない。線の濃さは alpha で持ち、塗りは背景の要素がトークンの色で当てる。
 * 筆の順に描くための `--t`、`--d`、`pathLength` は、mask では読まないが、`inkSvg()` の出力の形に依りすぎないよう残す。
 */
export function inkBackgroundSvg(ink: InkSvg = inkSvg()): string {
  const tag = /^<svg class="ink-svg" (viewBox="[^"]+") aria-hidden="true" focusable="false">/;
  if (!tag.test(ink.svg)) throw new Error("inkSvg() の開きタグの形が変わった");
  return ink.svg
    .replace(
      tag,
      `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" $1>${STYLE}`,
    )
    .replaceAll("var(--art-pine)", "black");
}
