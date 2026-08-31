export type TatePart = { text: string; upright: boolean };

/** 超えると 1 マスに収めたとき字が読めなくなる */
const MAX_TCY_LENGTH = 3;

/** 区切り記号をまたがない (`3.5` は 2 つの塊) */
const RUN = /[0-9A-Za-z]+/g;

/** JLReq では縦組みの欧文は 90 度回転が原則で、短い数字・略語だけを縦中横にする */
export function tcy(text: string): TatePart[] {
  const parts: TatePart[] = [];
  let at = 0;

  for (const m of text.matchAll(RUN)) {
    const run = m[0];
    if (run.length > MAX_TCY_LENGTH) continue;
    if (m.index > at) parts.push({ text: text.slice(at, m.index), upright: false });
    parts.push({ text: run, upright: true });
    at = m.index + run.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), upright: false });
  return parts;
}
