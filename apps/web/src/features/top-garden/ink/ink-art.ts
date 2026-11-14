import { brush, type Stroke, type Tint } from "./brush";
import {
  CAM0,
  DESIGN,
  GATE,
  GATE_Z,
  MOUNTAINS,
  STEPS,
  STEP_R,
  WALL,
  project,
  type Vec2,
} from "../layout";

export interface InkArt {
  readonly strokes: readonly Stroke[];
  readonly tints: readonly Tint[];
}

const INK_SEED = 7;
// 飛び石の楕円の縦横の比に使う、最初のカメラの焦点距離（px）の丸めた値。計算した値（約 1060.1）に替えると出力が変わる
const STEP_FOCAL = 1060;

/**
 * 墨の絵の線を、山並み、塀、門、飛び石、石、松の順に作る。
 * 門と塀と飛び石は、立体の配置を最初のカメラで投影した位置に置く。
 */
export function inkArt(seed = INK_SEED): InkArt {
  const B = brush(seed);
  const P = (x: number, y: number, z: number) => project([x, y, z]);
  for (const m of MOUNTAINS) B.mountain(m.peaks, m.base, m.x0, m.x1, m.n, m.alpha, m.t0);

  ([-1, 1] as const).forEach((s, i) => {
    const a = P(s * WALL.x0, WALL.roofY, GATE_Z),
      b = P(s * WALL.x1, WALL.roofY, GATE_Z),
      g0 = P(s * WALL.x0, 0, GATE_Z);
    const end = s < 0 ? -60 : DESIGN.w + 60;
    B.add(
      "mid",
      [
        [a[0], a[1]],
        [(a[0] + end) / 2, a[1] + 3],
        [end, b[1] - 2],
      ],
      { w: 11, a: 0.8, dry: 0.55, t0: 700 + i * 160, dur: 520, tin: 0.04 },
    );
    B.add(
      "mid",
      [
        [a[0], a[1] + 14],
        [(a[0] + end) / 2, a[1] + 16],
        [end, a[1] + 13],
      ],
      { w: 3, a: 0.45, dry: 0.7, t0: 820 + i * 160, dur: 460 },
    );
    B.add(
      "mid",
      [
        [g0[0] + s * 8, g0[1]],
        [(g0[0] + end) / 2, g0[1] + 4],
        [end, g0[1] + 1],
      ],
      { w: 3, a: 0.4, dry: 0.85, t0: 980 + i * 140, dur: 480 },
    );
    for (let k = 0; k < 4; k++) {
      const x = a[0] + s * (90 + k * 150);
      B.add(
        "mid",
        [
          [x, a[1] + 22],
          [x + 2, (a[1] + g0[1]) / 2],
          [x - 1, g0[1] - 6],
        ],
        { w: 2, a: 0.16, dry: 0.9, t0: 1050 + k * 50, dur: 260 },
      );
    }
  });

  GATE.posts.forEach(([x, y, z, w, h], i) => {
    const top = P(x, y + h / 2, z),
      bot = P(x, 0, z);
    B.add(
      "mid",
      [
        [bot[0], top[1]],
        [bot[0] + 2, (top[1] + bot[1]) / 2],
        [bot[0], bot[1]],
      ],
      {
        w: w * top[2] * 0.9,
        a: 0.88,
        dry: 0.5,
        t0: 1180 + i * 190,
        dur: 430,
        tin: 0.03,
        tout: 0.2,
      },
    );
  });
  GATE.beams.forEach(([x, y, z, w, h]) => {
    const a = P(x - w / 2, y, z),
      b = P(x + w / 2, y, z);
    B.add(
      "mid",
      [
        [a[0], a[1]],
        [(a[0] + b[0]) / 2, a[1] - 2],
        [b[0], b[1]],
      ],
      { w: h * a[2] * 0.9, a: 0.85, dry: 0.5, t0: 1620, dur: 380, tin: 0.04, tout: 0.2 },
    );
  });

  // 屋根。鳥居に見えないよう、棟、軒、両端の破風を太い線で囲み、間に瓦の線を引いて、屋根の面を台形に見せる。
  const rf = GATE.roof;
  const rl = P(-rf.halfW, rf.ridgeY + 0.08, GATE_Z),
    rr = P(rf.halfW, rf.ridgeY + 0.08, GATE_Z);
  const el = P(-rf.halfW, rf.eaveY, GATE_Z + rf.depth),
    er = P(rf.halfW, rf.eaveY, GATE_Z + rf.depth);
  B.add(
    "mid",
    [
      [rl[0] - 8, rl[1] - 6],
      [rl[0] + 90, rl[1]],
      [(rl[0] + rr[0]) / 2, rl[1] + 1],
      [rr[0] - 90, rr[1]],
      [rr[0] + 8, rr[1] - 6],
    ],
    { w: 20, a: 0.9, dry: 0.45, t0: 1900, dur: 480, tin: 0.05, tout: 0.2 },
  );
  (
    [
      [rl, el, -1],
      [rr, er, 1],
    ] as const
  ).forEach(([r0, e0, s], i) => {
    B.add(
      "mid",
      [
        [r0[0], r0[1]],
        [(r0[0] + e0[0]) / 2 + s * 3, (r0[1] + e0[1]) / 2],
        [e0[0] + s * 6, e0[1] + 4],
      ],
      { w: 9, a: 0.85, dry: 0.5, t0: 2040 + i * 90, dur: 260 },
    );
  });
  B.add(
    "mid",
    [
      [el[0] - 10, el[1] - 4],
      [el[0] + 110, el[1] + 2],
      [(el[0] + er[0]) / 2, el[1] + 4],
      [er[0] - 110, er[1] + 2],
      [er[0] + 10, er[1] - 4],
    ],
    { w: 13, a: 0.88, dry: 0.5, t0: 2220, dur: 500, tin: 0.05, tout: 0.2 },
  );
  B.add(
    "mid",
    [
      [el[0] + 20, el[1] + 16],
      [(el[0] + er[0]) / 2, el[1] + 18],
      [er[0] - 20, er[1] + 16],
    ],
    { w: 3, a: 0.5, dry: 0.7, t0: 2330, dur: 420 },
  );
  for (let k = 1; k < 22; k++) {
    const u = k / 22,
      x0 = rl[0] + (rr[0] - rl[0]) * u,
      x1 = el[0] + (er[0] - el[0]) * u;
    B.add(
      "mid",
      [
        [x0, rl[1] + 10],
        [(x0 + x1) / 2, (rl[1] + el[1]) / 2 + 3],
        [x1, el[1] - 7],
      ],
      { w: 2.6, a: 0.5, dry: 0.6, t0: 2360 + k * 14, dur: 150 },
    );
  }

  ([-1, 1] as const).forEach((s, i) => {
    const d = GATE.door,
      n0 = P(s * d.x, d.h, GATE_Z - 0.08),
      f0 = P(s * d.x, d.h, GATE_Z - 0.08 - d.len),
      f1 = P(s * d.x, 0, GATE_Z - 0.08 - d.len),
      n1 = P(s * d.x, 0, GATE_Z - 0.08);
    B.add(
      "mid",
      [
        [n0[0], n0[1]],
        [(n0[0] + f0[0]) / 2, (n0[1] + f0[1]) / 2],
        [f0[0], f0[1]],
      ],
      { w: 3, a: 0.6, dry: 0.6, t0: 2520 + i * 70, dur: 200 },
    );
    B.add(
      "mid",
      [
        [f0[0], f0[1]],
        [f0[0], (f0[1] + f1[1]) / 2],
        [f1[0], f1[1]],
      ],
      { w: 3.4, a: 0.6, dry: 0.6, t0: 2580 + i * 70, dur: 260 },
    );
    for (const u of [0.35, 0.7]) {
      const line: Vec2[] = [
        [n0[0], n0[1] + (n1[1] - n0[1]) * u],
        [
          (n0[0] + f0[0]) / 2,
          (n0[1] + f0[1]) / 2 + ((n1[1] + f1[1]) / 2 - (n0[1] + f0[1]) / 2) * u,
        ],
        [f0[0], f0[1] + (f1[1] - f0[1]) * u],
      ];
      B.add("mid", line, { w: 2, a: 0.35, dry: 0.75, t0: 2660 + i * 70, dur: 160 });
    }
  });

  STEPS.forEach(([x, z], i) => {
    const c = P(x, 0, z);
    if (c[1] > DESIGN.h + 40) return;
    const rx = STEP_R * c[2],
      ry = rx * Math.min(0.5, (CAM0.pos[1] * c[2]) / STEP_FOCAL) * 1.1,
      arc: Vec2[] = [];
    for (let q = 0; q <= 14; q++) {
      const an = Math.PI * 2 * (q / 14) - 2.6;
      arc.push([c[0] + Math.cos(an) * rx, c[1] + Math.sin(an) * ry]);
    }
    B.add("mid", arc, {
      w: z > GATE_Z ? 4 : 2.4,
      a: z > GATE_Z ? 0.6 : 0.35,
      dry: 0.7,
      t0: 2480 + i * 60,
      dur: 260,
    });
  });
  B.stone(330, 729, 190, 112, 1350);
  B.stone(213, 731, 80, 42, 1560);

  B.add(
    "near",
    [
      [1690, 520],
      [1612, 430],
      [1560, 330],
      [1522, 240],
      [1500, 150],
    ],
    { w: 30, a: 0.8, dry: 0.5, t0: 2500, dur: 520, tin: 0.02 },
  );
  B.add(
    "near",
    [
      [1700, 500],
      [1626, 420],
      [1576, 322],
      [1538, 236],
    ],
    { w: 9, a: 0.85, dry: 0.35, t0: 2620, dur: 460, tin: 0.02 },
  );
  B.branch(
    [
      [1508, 160],
      [1400, 104],
      [1262, 72],
      [1120, 70],
      [1000, 96],
    ],
    11,
    2850,
    480,
    6,
    50,
  );
  B.branch(
    [
      [1548, 322],
      [1470, 312],
      [1392, 328],
      [1330, 362],
    ],
    7,
    3120,
    380,
    3,
    44,
  );
  return { strokes: B.strokes, tints: B.tints };
}
