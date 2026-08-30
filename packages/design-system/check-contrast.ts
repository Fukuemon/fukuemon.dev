/**
 * 配色の検査。ビルド前に走らせる。
 *
 * 1. `code-theme.ts` の値が `tokens.css` の `--c-*` と一致すること
 * 2. 文字に使うトークンが地に対して 4.5:1 以上であること
 * 3. コードの 5 トークンが輝度の梯子になっていること
 *
 * 色は手で書き換えるものなので、ずれても実行時には気づけない。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DARK, LIGHT } from "./code-theme.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace("#", "").toLowerCase();
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** tokens.css からブロックごとにカスタムプロパティを読む */
function readTokens(): { light: Map<string, string>; dark: Map<string, string> } {
  const css = readFileSync(here("./styles/tokens.css"), "utf8");
  const pick = (start: string) => {
    const i = css.indexOf(start);
    if (i < 0) throw new Error(`tokens.css に ${start} が無い`);
    const body = css.slice(i, css.indexOf("\n}", i));
    const map = new Map<string, string>();
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
      map.set(m[1] as string, (m[2] as string).toLowerCase());
    }
    return map;
  };
  return { light: pick(":root {"), dark: pick('[data-theme="dark"] {') };
}

const CODE_KEYS = ["plain", "key", "ident", "lit", "com"] as const;
const MIN_TEXT = 4.5;

export function checkContrast(): string[] {
  const errors: string[] = [];
  const tokens = readTokens();

  for (const [name, palette, map] of [
    ["明", LIGHT, tokens.light],
    ["暗", DARK, tokens.dark],
  ] as const) {
    // 1. code-theme.ts と tokens.css が一致するか
    const bg = map.get("--code-bg");
    if (bg !== palette.bg) {
      errors.push(`${name}: --code-bg が ${bg} / code-theme.ts が ${palette.bg}`);
    }
    for (const k of CODE_KEYS) {
      const css = map.get(`--c-${k}`);
      if (css !== palette[k]) {
        errors.push(`${name}: --c-${k} が ${css} / code-theme.ts が ${palette[k]}`);
      }
    }

    // 2. コードの 5 トークンが 4.5:1 以上か
    for (const k of CODE_KEYS) {
      const r = contrast(palette[k], palette.bg);
      if (r < MIN_TEXT) errors.push(`${name}: --c-${k} が ${r.toFixed(2)} (4.5 未満)`);
    }

    // 3. 文字に使うトークンが地に対して 4.5:1 以上か
    const paper = map.get("--paper");
    if (paper) {
      for (const k of ["--ink", "--ink-2", "--green", "--blue", "--rust", "--rule-strong"]) {
        const v = map.get(k);
        if (!v) continue;
        const r = contrast(v, paper);
        if (r < MIN_TEXT) errors.push(`${name}: ${k} が地に対して ${r.toFixed(2)} (4.5 未満)`);
      }
    }

    // 4. 輝度の梯子が単調か
    const ladder = CODE_KEYS.map((k) => contrast(palette[k], palette.bg)).sort((a, b) => b - a);
    for (let i = 0; i < ladder.length - 1; i++) {
      const gap = (ladder[i] as number) / (ladder[i + 1] as number);
      if (gap < 1.1) errors.push(`${name}: 隣接するトークンの比が ${gap.toFixed(2)} (1.10 未満)`);
    }
  }
  return errors;
}

const errors = checkContrast();
if (errors.length > 0) {
  console.error("配色の検査に失敗しました:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("配色の検査を通過しました");
