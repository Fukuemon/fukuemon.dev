/**
 * 署名の SVG のファイルの中身から、HTML に置く `<svg class="sign">` の文字列を作る。
 * ファイルは、`viewBox` と、輪郭を塗った `path` を 1 本だけ持つ形にする。線（stroke）で描いた形は、塗っても字にならないので受け付けない。
 * @throws 形が違うとき
 */
export function signSvg(source: string): string {
  const root = /<svg\b[^>]*>/.exec(source)?.[0];
  if (!root) throw new Error("署名の SVG に <svg> がない");
  const viewBox = /\sviewBox="([^"]+)"/.exec(root)?.[1];
  if (!viewBox) throw new Error("署名の SVG の <svg> に viewBox がない");
  const paths = source.match(/<path\b[^>]*>/g) ?? [];
  if (paths.length !== 1)
    throw new Error(`署名の SVG の path は 1 本にする（${paths.length} 本ある）`);
  const path = paths[0]!;
  if (/\sstroke(-width)?="/.test(path) || /\sfill="none"/.test(path))
    throw new Error("署名の SVG の path は、線ではなく輪郭を塗った形にする");
  const d = /\sd="([^"]+)"/.exec(path)?.[1];
  if (!d) throw new Error("署名の SVG の path に d がない");
  return `<svg class="sign" viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}
