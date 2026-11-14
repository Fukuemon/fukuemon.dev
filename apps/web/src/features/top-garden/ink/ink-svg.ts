import type { Layer, Stroke, Tint } from "./brush";
import { rng } from "../rng";
import { inkArt, type InkArt } from "./ink-art";
import { DESIGN } from "../layout";

/** 試作の時刻（ms）に掛ける倍率。試作と同じ値である。 */
const TIME_SCALE = 3150 / 3900;
const RENDER_SEED = 11;

const round1 = (v: number) => String(Math.round(v * 10) / 10);

export interface RenderedLayers {
  /** 層ごとの、線 1 本を包む `<g>` の文字列の列 */
  readonly layers: Readonly<Record<Layer, readonly string[]>>;
  /** `path` の数 */
  readonly paths: number;
}

/**
 * 線 1 本を、幅に応じて 1〜5 本の `path` にする。外側の `path` ほど、入りと抜きで中心へ寄り、短くなる。
 * 線ごとの `<g>` は、CSS の遷移で筆の順に描くための `--t`（始める時刻）と `--d`（描く時間）を持つ。
 */
export function renderStrokes(strokes: readonly Stroke[], scale = TIME_SCALE): RenderedLayers {
  const Q = rng(RENDER_SEED);
  const out: Record<Layer, string[]> = { far: [], mid: [], near: [] };
  let paths = 0;
  for (const st of strokes) {
    const p = st.p,
      n = p.length - 1;
    const nb = Math.max(1, Math.min(5, Math.round(st.w / 5)));
    const step = Math.max(1, Math.round(n / Math.max(6, Math.min(40, n / 4))));
    const parts: string[] = [];
    for (let b = 0; b < nb; b++) {
      const off = nb === 1 ? 0 : (b / (nb - 1) - 0.5) * st.w * 0.82;
      const edge = nb === 1 ? 0 : Math.abs(b / (nb - 1) - 0.5) * 2;
      const i0 = Math.round(n * edge * st.tin * (0.3 + 0.5 * Q())),
        i1 = n - Math.round(n * edge * st.tout * (0.3 + 0.6 * Q()));
      let d = "";
      for (let i = i0; i <= i1; i += step) {
        const u = i / n,
          pt = p[i]!,
          a = p[Math.max(0, i - 1)]!,
          c = p[Math.min(n, i + 1)]!;
        const dx = c[0] - a[0],
          dy = c[1] - a[1],
          len = Math.hypot(dx, dy) || 1;
        const wf = Math.pow(Math.min(1, u / st.tin) * Math.min(1, (1 - u) / st.tout), 0.6);
        d +=
          (d ? "L" : "M") +
          round1(pt[0] - (dy / len) * off * wf) +
          " " +
          round1(pt[1] + (dx / len) * off * wf);
        // 最後の点を必ず通る。
        if (i < i1 && i + step > i1) i = i1 - step;
      }
      const width = nb === 1 ? st.w * 0.55 + st.lw * 0.5 : (st.w / nb) * 1.15 + st.lw * 0.4;
      const alpha = Math.min(1, st.a * (0.62 + 0.38 * Q()) * (nb === 1 ? 0.9 : 0.8));
      parts.push(
        `<path pathLength="1" d="${d}" stroke-width="${round1(width)}" stroke-opacity="${Math.round(alpha * 100) / 100}"/>`,
      );
      paths++;
    }
    out[st.layer].push(
      `<g style="--t:${Math.round(st.t0 * scale)}ms;--d:${Math.round(st.dur * scale)}ms">${parts.join("")}</g>`,
    );
  }
  return { layers: out, paths };
}

function tintCircles(tints: readonly Tint[]): string {
  return tints
    .map((t) => `<circle cx="${Math.round(t.x)}" cy="${Math.round(t.y)}" r="${Math.round(t.r)}"/>`)
    .join("");
}

const DEFS =
  "<defs>" +
  '<filter id="f-dry" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.9" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>' +
  '<filter id="f-wash" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
  '<radialGradient id="g-pine"><stop offset="0" stop-color="var(--art-pine)"/><stop offset="1" stop-color="var(--art-pine)" stop-opacity="0"/></radialGradient>' +
  "</defs>";

export interface InkSvg {
  readonly svg: string;
  readonly strokes: number;
  readonly paths: number;
}

/**
 * 墨の絵を、HTML に置く `<svg class="ink-svg">` の文字列にする。
 * 線の色と、かすれの filter の掛け方は、`InkGate.astro` の CSS が、class（`far`、`mid`、`near`、`lines`、`pine`）と id（`f-dry`、`f-wash`、`g-pine`）で引く。
 * 松の円の色は CSS 変数 `--art-pine` で決める。筆の順に描く動きは、この文字列の外の CSS が付ける。
 */
export function inkSvg(art: InkArt = inkArt()): InkSvg {
  const r = renderStrokes(art.strokes);
  const svg =
    `<svg class="ink-svg" viewBox="0 0 ${DESIGN.w} ${DESIGN.h}" aria-hidden="true" focusable="false">` +
    DEFS +
    `<g class="far">${r.layers.far.join("")}</g>` +
    `<g class="mid">${r.layers.mid.join("")}</g>` +
    `<g class="near"><g class="pine">${tintCircles(art.tints)}</g><g class="lines">${r.layers.near.join("")}</g></g>` +
    "</svg>";
  return { svg, strokes: art.strokes.length, paths: r.paths };
}
