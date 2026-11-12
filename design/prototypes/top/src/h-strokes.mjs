// 水墨の絵の線のデータを作り、線ごとの SVG の path に書き出す。ブラウザの API を使わない。
// 線を作る部分は e-ink.js と同じ乱数の順で、彼岸花を除いてある。帯の形に合わせて、層ごとに上へ寄せる。
const SCALE = 3150 / 3900;
const f1 = (v) => String(Math.round(v * 10) / 10);
export const VIEW = { w: 1600, h: 660 };
const SHIFT = { far: -90, mid: -185, near: -160 };

function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function brush(seed) {
  const R = rng(seed);
  const strokes = [];
  const tints = [];
  function add(layer, pts, o) {
    const p = sample(pts, 3);
    const n = Math.max(1, Math.round(o.w / 1.5));
    // e-ink.js と同じ数だけ乱数を進める。毛ごとの値は、SVG では使わない。
    for (let b = 0; b < n; b++) { R(); R(); R(); R(); }
    strokes.push({ layer, p, w: o.w, a: o.a, dry: o.dry == null ? 0.4 : o.dry, t0: o.t0, dur: o.dur, tin: o.tin == null ? 0.12 : o.tin, tout: o.tout == null ? 0.3 : o.tout, lw: o.lw || 1.7 });
  }
  function mountain(peaks, base, x0, x1, n, alpha, t0) {
    const y = (x) => base - peaks.reduce((s, p) => s + p[1] * Math.exp(-Math.pow((x - p[0]) / p[2], 2)), 0);
    for (let k = -1; k < n; k++) {
      const pts = [];
      for (let x = x0; x <= x1; x += 45) { const yy = y(x) + Math.max(0, k) * 15; if (yy < base - 6) pts.push([x, yy + (k < 0 ? 0 : (R() - 0.5) * 5)]); }
      if (pts.length < 3) continue;
      if (k < 0) add("far", pts, { w: 4, a: alpha * 2.4, dry: 0.55, t0, dur: 750, tin: 0.25, tout: 0.3 });
      else add("far", pts, { w: 30, a: alpha * Math.pow(1 - k / n, 1.4), dry: 0.12, lw: 5, t0: t0 + 120 + k * 45, dur: 650, tin: 0.3, tout: 0.3 });
    }
  }
  function stone(cx, by, w, h, t0) {
    const hw = (v) => (w / 2) * Math.pow(v, 0.6) * (1 + 0.06 * Math.sin(v * 9 + cx));
    const mid = (v) => cx - w * 0.1 * (1 - v);
    const rows = Math.round(h / 8);
    for (let k = 1; k <= rows; k++) {
      const v = k / rows, yy = by - h * (1 - v), m = mid(v), e = hw(v), ridge = m - e * 0.15;
      add("mid", [[m - e, yy], [(m - e + ridge) / 2, yy - 2], [ridge, yy]], { w: 9, a: 0.16 + 0.12 * v, dry: 0.5, lw: 2.6, t0: t0 + 150 + k * 22, dur: 200, tin: 0.1, tout: 0.2 });
      add("mid", [[ridge, yy], [(m + e + ridge) / 2, yy - 2], [m + e, yy]], { w: 9, a: 0.5 + 0.3 * v, dry: 0.4, lw: 2.6, t0: t0 + 180 + k * 22, dur: 220, tin: 0.05, tout: 0.2 });
    }
    const o = [];
    for (let q = 0; q <= 16; q++) { const vv = Math.abs(1 - q / 8), sg = q < 8 ? -1 : 1; o.push([mid(vv) + sg * hw(vv), by - h * (1 - vv)]); }
    add("mid", o, { w: w * 0.03 + 4, a: 0.85, dry: 0.45, t0, dur: 420 });
    add("mid", [[cx - w * 0.62, by + 5], [cx, by + 9], [cx + w * 0.72, by + 4]], { w: 7, a: 0.4, dry: 0.75, t0: t0 + 600, dur: 300 });
    for (let r = 0; r < 3; r++) {
      const arc = [];
      for (let q = 0; q <= 12; q++) { const an = Math.PI * (q / 12); arc.push([cx + Math.cos(an) * (w * 0.78 + r * 30), by + 12 + Math.sin(an) * (26 + r * 13)]); }
      add("mid", arc, { w: 2.4, a: 0.3, dry: 0.85, t0: 1650 + r * 110 + (cx > 800 ? 150 : 0), dur: 420 });
    }
  }
  function needles(cx, cy, r, t0) {
    for (let k = 0; k < 17; k++) {
      const an = -Math.PI * (0.06 + 0.88 * (k / 16)) + (R() - 0.5) * 0.12, len = r * (0.75 + R() * 0.35);
      add("near", [[cx, cy], [cx + Math.cos(an) * len * 0.5, cy + Math.sin(an) * len * 0.52], [cx + Math.cos(an) * len, cy + Math.sin(an) * len]], { w: 2.3, a: 0.8, dry: 0.3, t0: t0 + k * 11, dur: 110, tin: 0.05, tout: 0.5 });
    }
    tints.push({ layer: "near", x: cx, y: cy - r * 0.4, r: r * 1.15 });
  }
  function branch(pts, w, t0, dur, n, r) {
    add("near", pts, { w, a: 0.85, dry: 0.5, t0, dur, tout: 0.45 });
    const p = sample(pts, 3);
    for (let k = 0; k < n; k++) {
      const q = p[Math.floor(p.length * (0.22 + 0.78 * ((k + 0.5) / n)))];
      needles(q[0] + (R() - 0.5) * 24, q[1] - 6 - R() * 10, r * (0.85 + R() * 0.3), t0 + dur * 0.5 + k * 95);
    }
  }

  return { add, mountain, stone, needles, branch, strokes, tints };
}

export function build() {
  const { add, mountain, stone, branch, strokes, tints } = brush(7);
  mountain([[240, 215, 170], [520, 135, 150], [770, 75, 170]], 545, -80, 1010, 11, 0.1, 0);
  mountain([[980, 150, 230], [1330, 95, 210]], 520, 640, 1640, 8, 0.055, 280);
  stone(560, 745, 270, 175, 800);
  stone(985, 795, 150, 82, 1120);
  stone(405, 782, 96, 46, 1300);
  for (let s = 0; s < 5; s++) {
    const line = [];
    for (let lx = 150 + s * 40; lx <= 1380 - s * 60; lx += 90) line.push([lx, 850 + s * 26 + Math.sin(lx * 0.006 + s) * 5]);
    // 帯の高さに収まる 1 本目だけを残す。
    if (s === 0) add("mid", line, { w: 2, a: 0.2, dry: 0.8, t0: 1750 + s * 80, dur: 520 });
  }
  add("near", [[1650, 715], [1565, 615], [1505, 505], [1445, 425], [1375, 352]], { w: 30, a: 0.8, dry: 0.5, t0: 1450, dur: 620, tin: 0.02 });
  add("near", [[1662, 690], [1580, 600], [1522, 498], [1462, 418]], { w: 9, a: 0.85, dry: 0.35, t0: 1620, dur: 520, tin: 0.02 });
  branch([[1452, 432], [1330, 382], [1180, 352], [1020, 348], [885, 374]], 11, 1950, 520, 7, 56);
  branch([[1392, 362], [1300, 292], [1182, 252], [1062, 244]], 8, 2120, 460, 5, 50);
  branch([[1502, 522], [1400, 524], [1292, 548], [1204, 594]], 7, 2260, 420, 4, 46);
  return { strokes, tints };
}

// 線 1 本を、幅に応じて 1〜5 本の path にする。外側の path ほど、入りと抜きで中心へ寄り、短くなる。
export function toSvg() {
  const { strokes, tints } = build();
  const r = render(strokes, SHIFT);
  const pine = tints.map((t) => `<circle cx="${f1(t.x)}" cy="${f1(t.y + SHIFT.near)}" r="${f1(t.r)}"/>`).join("");
  return { layers: r.layers, pine, strokes: strokes.length, paths: r.paths };
}

export function render(strokes, SHIFT = { far: 0, mid: 0, near: 0 }, scale = SCALE) {
  const Q = rng(11);
  const out = { far: [], mid: [], near: [] };
  let paths = 0;
  for (const st of strokes) {
    const dy = SHIFT[st.layer];
    const p = st.p, n = p.length - 1;
    const nb = Math.max(1, Math.min(5, Math.round(st.w / 5)));
    const step = Math.max(1, Math.round(n / Math.max(6, Math.min(40, n / 4))));
    const parts = [];
    for (let b = 0; b < nb; b++) {
      const off = nb === 1 ? 0 : (b / (nb - 1) - 0.5) * st.w * 0.82;
      const edge = nb === 1 ? 0 : Math.abs(b / (nb - 1) - 0.5) * 2;
      const i0 = Math.round(n * edge * st.tin * (0.3 + 0.5 * Q())), i1 = n - Math.round(n * edge * st.tout * (0.3 + 0.6 * Q()));
      let d = "";
      for (let i = i0; i <= i1; i += step) {
        const u = i / n, a = p[Math.max(0, i - 1)], c = p[Math.min(n, i + 1)];
        const dx = c[0] - a[0], ddy = c[1] - a[1], len = Math.hypot(dx, ddy) || 1;
        const wf = Math.pow(Math.min(1, u / st.tin) * Math.min(1, (1 - u) / st.tout), 0.6);
        d += (d ? "L" : "M") + f1(p[i][0] - (ddy / len) * off * wf) + " " + f1(p[i][1] + dy + (dx / len) * off * wf);
        if (i < i1 && i + step > i1) i = i1 - step;
      }
      const width = nb === 1 ? st.w * 0.55 + st.lw * 0.5 : (st.w / nb) * 1.15 + st.lw * 0.4;
      const alpha = Math.min(1, st.a * (0.62 + 0.38 * Q()) * (nb === 1 ? 0.9 : 0.8));
      parts.push(`<path pathLength="1" d="${d}" stroke-width="${f1(width)}" stroke-opacity="${Math.round(alpha * 100) / 100}"/>`);
      paths++;
    }
    out[st.layer].push(`<g style="--t:${Math.round(st.t0 * scale)}ms;--d:${Math.round(st.dur * scale)}ms">${parts.join("")}</g>`);
  }
  return { layers: out, paths };
}
