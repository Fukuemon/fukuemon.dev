export type TatePart = { text: string; upright: boolean };

/** 縦中横にする長さの上限。超えると 1 マスに畳んだとき字が潰れる */
const MAX = 3;

/** 連続する半角英数字。区切り記号をまたがない (`3.5` は 2 つの塊) */
const RUN = /[0-9A-Za-z]+/g;

/**
 * 縦組みの文字列を、正立させる塊とそれ以外に割る。
 * JLReq では縦組みの欧文は 90 度回転が原則で、短い数字・略語だけを縦中横にする。
 *
 * @example tcy("WAL と OpenTelemetry") // WAL だけ upright: true
 */
export function tcy(text: string): TatePart[] {
  const parts: TatePart[] = [];
  let at = 0;

  for (const m of text.matchAll(RUN)) {
    const run = m[0];
    if (run.length > MAX) continue;
    if (m.index > at) parts.push({ text: text.slice(at, m.index), upright: false });
    parts.push({ text: run, upright: true });
    at = m.index + run.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), upright: false });
  return parts;
}
