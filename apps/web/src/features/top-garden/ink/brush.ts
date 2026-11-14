import { ridgeY, type Peak, type Vec2 } from "../layout";
import { rng } from "../rng";

export type Layer = "far" | "mid" | "near";

interface StrokeOptions {
  /** 筆の太さ（px） */
  readonly w: number;
  /** 墨の濃さ（0〜1） */
  readonly a: number;
  /** かすれ（0〜1） */
  readonly dry?: number;
  /** 描き始める時刻（ms） */
  readonly t0: number;
  /** 描く時間（ms） */
  readonly dur: number;
  /** 入りの長さ（線の長さに対する割合） */
  readonly tin?: number;
  /** 抜きの長さ（線の長さに対する割合） */
  readonly tout?: number;
  /** 線の太さに足す幅（px） */
  readonly lw?: number;
}

/** 筆の線 1 本。p は 3 px ごとに取った中心線の点の列である。 */
export interface Stroke extends Required<StrokeOptions> {
  readonly layer: Layer;
  readonly p: readonly Vec2[];
}

/** 松の葉の下に敷く、淡い円 */
export interface Tint {
  readonly layer: Layer;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** 点の列を Catmull-Rom の曲線でつなぎ、step（px）ほどの間隔で取り直す。 */
export function sample(pts: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [];
  const at = (i: number) => pts[Math.min(pts.length - 1, Math.max(0, i))]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = at(i - 1),
      b = at(i),
      c = at(i + 1),
      d = at(i + 2);
    const n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
    const f = (j: 0 | 1, t: number) => {
      const t2 = t * t,
        t3 = t2 * t;
      return (
        0.5 *
        (2 * b[j] +
          (c[j] - a[j]) * t +
          (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 +
          (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3)
      );
    };
    for (let k = 0; k < n; k++) out.push([f(0, k / n), f(1, k / n)]);
  }
  out.push(at(pts.length - 1));
  return out;
}

/** 松の葉の線の置き方。既定は、近景の層に置き、下に淡い円を敷く */
export interface NeedleOptions {
  readonly layer?: Layer;
  readonly tint?: boolean;
}

export interface Brush {
  readonly strokes: readonly Stroke[];
  readonly tints: readonly Tint[];
  add(layer: Layer, pts: readonly Vec2[], o: StrokeOptions): void;
  mountain(
    peaks: readonly Peak[],
    base: number,
    x0: number,
    x1: number,
    n: number,
    alpha: number,
    t0: number,
  ): void;
  stone(cx: number, by: number, w: number, h: number, t0: number): void;
  needles(cx: number, cy: number, r: number, t0: number, o?: NeedleOptions): void;
  branch(pts: readonly Vec2[], w: number, t0: number, dur: number, n: number, r: number): void;
}

/**
 * 筆の線を溜める筆を作る。同じ種で同じ順に呼べば、同じ線ができる。
 * 乱数を進める順は試作（`docs/design/prototypes/top/src/h-strokes.mjs`）と同じにしてあり、順を変えると絵が変わる。
 */
export function brush(seed: number): Brush {
  const R = rng(seed);
  const strokes: Stroke[] = [];
  const tints: Tint[] = [];

  function add(layer: Layer, pts: readonly Vec2[], o: StrokeOptions): void {
    const p = sample(pts, 3);
    // 試作の Canvas 版は毛ごとに乱数を 4 つ使う。SVG では使わないが、後の線を同じにするため同じ数だけ進める。
    const n = Math.max(1, Math.round(o.w / 1.5));
    for (let b = 0; b < n; b++) {
      R();
      R();
      R();
      R();
    }
    strokes.push({
      layer,
      p,
      w: o.w,
      a: o.a,
      dry: o.dry ?? 0.4,
      t0: o.t0,
      dur: o.dur,
      tin: o.tin ?? 0.12,
      tout: o.tout ?? 0.3,
      lw: o.lw ?? 1.7,
    });
  }

  function mountain(
    peaks: readonly Peak[],
    base: number,
    x0: number,
    x1: number,
    n: number,
    alpha: number,
    t0: number,
  ): void {
    const y = (x: number) => ridgeY({ peaks, base }, x);
    for (let k = -1; k < n; k++) {
      const pts: Vec2[] = [];
      for (let x = x0; x <= x1; x += 45) {
        const yy = y(x) + Math.max(0, k) * 15;
        if (yy < base - 6) pts.push([x, yy + (k < 0 ? 0 : (R() - 0.5) * 5)]);
      }
      if (pts.length < 3) continue;
      if (k < 0)
        add("far", pts, { w: 4, a: alpha * 2.4, dry: 0.55, t0, dur: 750, tin: 0.25, tout: 0.3 });
      else
        add("far", pts, {
          w: 30,
          a: alpha * Math.pow(1 - k / n, 1.4),
          dry: 0.12,
          lw: 5,
          t0: t0 + 120 + k * 45,
          dur: 650,
          tin: 0.3,
          tout: 0.3,
        });
    }
  }

  function stone(cx: number, by: number, w: number, h: number, t0: number): void {
    const hw = (v: number) => (w / 2) * Math.pow(v, 0.6) * (1 + 0.06 * Math.sin(v * 9 + cx));
    const mid = (v: number) => cx - w * 0.1 * (1 - v);
    const rows = Math.round(h / 8);
    for (let k = 1; k <= rows; k++) {
      const v = k / rows,
        yy = by - h * (1 - v),
        m = mid(v),
        e = hw(v),
        ridge = m - e * 0.15;
      add(
        "mid",
        [
          [m - e, yy],
          [(m - e + ridge) / 2, yy - 2],
          [ridge, yy],
        ],
        {
          w: 9,
          a: 0.16 + 0.12 * v,
          dry: 0.5,
          lw: 2.6,
          t0: t0 + 150 + k * 22,
          dur: 200,
          tin: 0.1,
          tout: 0.2,
        },
      );
      add(
        "mid",
        [
          [ridge, yy],
          [(m + e + ridge) / 2, yy - 2],
          [m + e, yy],
        ],
        {
          w: 9,
          a: 0.5 + 0.3 * v,
          dry: 0.4,
          lw: 2.6,
          t0: t0 + 180 + k * 22,
          dur: 220,
          tin: 0.05,
          tout: 0.2,
        },
      );
    }
    const o: Vec2[] = [];
    for (let q = 0; q <= 16; q++) {
      const vv = Math.abs(1 - q / 8),
        sg = q < 8 ? -1 : 1;
      o.push([mid(vv) + sg * hw(vv), by - h * (1 - vv)]);
    }
    add("mid", o, { w: w * 0.03 + 4, a: 0.85, dry: 0.45, t0, dur: 420 });
    add(
      "mid",
      [
        [cx - w * 0.62, by + 5],
        [cx, by + 9],
        [cx + w * 0.72, by + 4],
      ],
      { w: 7, a: 0.4, dry: 0.75, t0: t0 + 600, dur: 300 },
    );
    for (let r = 0; r < 3; r++) {
      const arc: Vec2[] = [];
      for (let q = 0; q <= 12; q++) {
        const an = Math.PI * (q / 12);
        arc.push([cx + Math.cos(an) * (w * 0.78 + r * 30), by + 12 + Math.sin(an) * (26 + r * 13)]);
      }
      add("mid", arc, {
        w: 2.4,
        a: 0.3,
        dry: 0.85,
        t0: 1650 + r * 110,
        dur: 420,
      });
    }
  }

  function needles(
    cx: number,
    cy: number,
    r: number,
    t0: number,
    { layer = "near", tint = true }: NeedleOptions = {},
  ): void {
    for (let k = 0; k < 17; k++) {
      const an = -Math.PI * (0.06 + 0.88 * (k / 16)) + (R() - 0.5) * 0.12,
        len = r * (0.75 + R() * 0.35);
      add(
        layer,
        [
          [cx, cy],
          [cx + Math.cos(an) * len * 0.5, cy + Math.sin(an) * len * 0.52],
          [cx + Math.cos(an) * len, cy + Math.sin(an) * len],
        ],
        { w: 2.3, a: 0.8, dry: 0.3, t0: t0 + k * 11, dur: 110, tin: 0.05, tout: 0.5 },
      );
    }
    if (tint) tints.push({ layer, x: cx, y: cy - r * 0.4, r: r * 1.15 });
  }

  function branch(
    pts: readonly Vec2[],
    w: number,
    t0: number,
    dur: number,
    n: number,
    r: number,
  ): void {
    add("near", pts, { w, a: 0.85, dry: 0.5, t0, dur, tout: 0.45 });
    const p = sample(pts, 3);
    for (let k = 0; k < n; k++) {
      const q = p[Math.floor(p.length * (0.22 + 0.78 * ((k + 0.5) / n)))]!;
      needles(
        q[0] + (R() - 0.5) * 24,
        q[1] - 6 - R() * 10,
        r * (0.85 + R() * 0.3),
        t0 + dur * 0.5 + k * 95,
      );
    }
  }

  return { strokes, tints, add, mountain, stone, needles, branch };
}
