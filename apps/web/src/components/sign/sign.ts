/**
 * 署名の SVG のファイルの中身を、HTML に置く `<svg>` の文字列にする。
 * 中身は変えずに通し、最初の `<svg>` に `className` の class と、読み上げから隠す属性だけを足す。
 * 読み上げの名前は、署名を置く側（ヘッダーのロゴのリンクなど）が持つ。
 */
export function signSvg(source: string, className = "sign"): string {
  return source
    .trim()
    .replace(/<svg\b/, `<svg class="${className}" aria-hidden="true" focusable="false"`);
}
