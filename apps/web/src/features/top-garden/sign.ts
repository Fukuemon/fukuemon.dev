/**
 * 署名の SVG のファイルの中身を、HTML に置く `<svg class="sign">` の文字列にする。
 * 中身は変えずに通し、最初の `<svg>` に class と、読み上げから隠す属性だけを足す。
 */
export function signSvg(source: string): string {
  return source.trim().replace(/<svg\b/, '<svg class="sign" aria-hidden="true" focusable="false"');
}
