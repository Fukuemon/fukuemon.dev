/**
 * 配色の検査。色は手で書き換えるものなので、ずれても実行時には気づけない。
 *
 * 1. 検査対象のトークンが `tokens.css` に実在すること
 * 2. `code-theme.ts` の値が `tokens.css` の `--color-c-*` と一致すること
 * 3. 文字に使うトークンが地に対して 4.5:1 以上であること
 * 4. コードの 5 トークンが輝度の梯子になっていること
 *
 * 1 を独立した検査にしているのは、トークン名が変わったときに
 * 2 以降が 1 件も実行されないまま通過するのを防ぐためである
 * (`context/engineering.md` の「実行されなかったことを通ったと扱わない」)。
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

/** ブラウザが読むのと同じ 1 箇所を読む。明暗で値がずれない */
function readTokens(): { light: Map<string, string>; dark: Map<string, string> } {
  const css = readFileSync(here("./styles/tokens.css"), "utf8");
  const i = css.indexOf("@theme");
  if (i < 0) throw new Error("tokens.css に @theme が無い");
  const body = css.slice(i, css.indexOf("\n}", i));
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const pair =
    /(--[a-z0-9-]+)\s*:\s*light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g;
  for (const m of body.matchAll(pair)) {
    light.set(m[1] as string, (m[2] as string).toLowerCase());
    dark.set(m[1] as string, (m[3] as string).toLowerCase());
  }
  if (light.size === 0) throw new Error("tokens.css から light-dark() を 1 つも読めなかった");
  return { light, dark };
}

const CODE_KEYS = ["plain", "key", "ident", "lit", "com"] as const;

/** 地に対して読める最低の比 (WCAG AA の本文) */
const MIN_TEXT = 4.5;

/** コードの隣り合うトークンを見分けられる最低の比 */
const MIN_LADDER_GAP = 1.1;

/** 地に対する比を検査する文字色 */
const TEXT_KEYS = [
  "--color-ink",
  "--color-ink-2",
  "--color-green",
  "--color-blue",
  "--color-rust",
  "--color-rule-strong",
] as const;

export function checkContrast(): string[] {
  const errors: string[] = [];
  const tokens = readTokens();

  for (const [name, palette, map] of [
    ["明", LIGHT, tokens.light],
    ["暗", DARK, tokens.dark],
  ] as const) {
    const need = (key: string): string | undefined => {
      const v = map.get(key);
      if (v === undefined) errors.push(`${name}: ${key} が tokens.css に無い`);
      return v;
    };

    const bg = need("--color-code-bg");
    if (bg !== undefined && bg !== palette.bg) {
      errors.push(`${name}: --color-code-bg が ${bg} / code-theme.ts が ${palette.bg}`);
    }
    for (const k of CODE_KEYS) {
      const key = `--color-c-${k}`;
      const css = need(key);
      if (css !== undefined && css !== palette[k]) {
        errors.push(`${name}: ${key} が ${css} / code-theme.ts が ${palette[k]}`);
      }
    }

    for (const k of CODE_KEYS) {
      const r = contrast(palette[k], palette.bg);
      if (r < MIN_TEXT) {
        errors.push(`${name}: --color-c-${k} が ${r.toFixed(2)} (${MIN_TEXT} 未満)`);
      }
    }

    const paper = need("--color-paper");
    for (const key of TEXT_KEYS) {
      const v = need(key);
      if (paper === undefined || v === undefined) continue;
      const r = contrast(v, paper);
      if (r < MIN_TEXT) {
        errors.push(`${name}: ${key} が地に対して ${r.toFixed(2)} (${MIN_TEXT} 未満)`);
      }
    }

    const ladder = CODE_KEYS.map((k) => contrast(palette[k], palette.bg)).sort((a, b) => b - a);
    for (let i = 0; i < ladder.length - 1; i++) {
      const gap = (ladder[i] as number) / (ladder[i + 1] as number);
      if (gap < MIN_LADDER_GAP) {
        errors.push(
          `${name}: 隣接するトークンの比が ${gap.toFixed(2)} (${MIN_LADDER_GAP.toFixed(2)} 未満)`,
        );
      }
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkContrast();
  if (errors.length > 0) {
    console.error("配色の検査に失敗しました:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log("配色の検査を通過しました");
}
