import { inkSvg, type InkSvg } from "./ink-svg";

/** 線の色と filter の掛け方。mask の画像にはページの CSS が当たらないので、SVG の中に持つ */
const STYLE =
  "<style>path{fill:none;stroke:black;stroke-linecap:round;stroke-linejoin:round}" +
  ".far{filter:url(#f-wash)}.mid,.near .lines{filter:url(#f-dry)}.pine{fill:url(#g-pine);opacity:.2}</style>";

/**
 * 庭を出さないときのトップの背景に、CSS の `mask-image` で掛ける墨の絵の SVG を作る。
 * イントロの墨の絵と同じ線で、色を持たない。線の濃さは alpha で持ち、塗りは背景の要素がトークンの色で当てる。
 */
export function inkBackgroundSvg(ink: InkSvg = inkSvg()): string {
  const open = '<svg class="ink-svg" ';
  const attrs = ' aria-hidden="true" focusable="false">';
  if (!ink.svg.startsWith(open) || !ink.svg.includes(attrs))
    throw new Error("inkSvg() の開きタグの形が変わった");
  return ink.svg
    .replace(open, '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" ')
    .replace(attrs, `>${STYLE}`)
    .replaceAll("var(--art-pine)", "black");
}
