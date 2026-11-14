import { sample, type Brush } from "./brush";
import {
  GATE,
  GATE_Z,
  OTHER_TREES,
  STATIONS,
  TREE_PADS,
  TRUNK,
  WALL,
  project,
  type Vec2,
  type Vec3,
} from "../layout";
import { rng } from "../rng";

const TREE_SEED = 17;

/** 1 本の木を描き始めてから、次の木を描き始めるまで（ms、試作の時刻の尺度） */
const TREE_GAP = 300;

interface InkTree {
  readonly at: Vec2;
  readonly s: number;
  readonly dir: 1 | -1;
  readonly pine: boolean;
}

/**
 * 点の列の上の位置 u（0〜1）の点。
 * 立体の木の幹（three の `CatmullRomCurve3` の既定の centripetal）の `getPoint(u)` と同じ式で、端の外の制御点は外挿する。
 */
export function along(pts: readonly Vec3[], u: number): Vec3 {
  const n = pts.length - 1;
  const pos = n * u;
  let i = Math.floor(pos),
    t = pos - i;
  if (i >= n) {
    i = n - 1;
    t = 1;
  }
  const b = pts[i]!,
    c = pts[i + 1]!;
  const outside = (p: Vec3, q: Vec3): Vec3 => [2 * p[0] - q[0], 2 * p[1] - q[1], 2 * p[2] - q[2]];
  const a = i > 0 ? pts[i - 1]! : outside(b, c);
  const d = i + 2 <= n ? pts[i + 2]! : outside(c, b);
  const gap = (p: Vec3, q: Vec3) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) ** 0.5;
  const dt1 = gap(b, c) < 1e-4 ? 1 : gap(b, c);
  const dt0 = gap(a, b) < 1e-4 ? dt1 : gap(a, b);
  const dt2 = gap(c, d) < 1e-4 ? dt1 : gap(c, d);
  const axis = (j: 0 | 1 | 2): number => {
    const t1 = ((b[j] - a[j]) / dt0 - (c[j] - a[j]) / (dt0 + dt1) + (c[j] - b[j]) / dt1) * dt1;
    const t2 = ((c[j] - b[j]) / dt1 - (d[j] - b[j]) / (dt1 + dt2) + (d[j] - c[j]) / dt2) * dt1;
    const c2 = -3 * b[j] + 3 * c[j] - 2 * t1 - t2,
      c3 = 2 * b[j] - 2 * c[j] + t1 + t2;
    return b[j] + t1 * t + c2 * t * t + c3 * t * t * t;
  };
  return [axis(0), axis(1), axis(2)];
}

/**
 * 最初のカメラで、塀、門の梁、屋根に隠れない画面の点か。
 * 木は塀より奥にあるので、塀の上か、門の柱の間の梁より下だけが見える。
 */
export function visible([x, y]: Vec2): boolean {
  const P = (wx: number, wy: number, wz: number) => project([wx, wy, wz]);
  const wallTop = P(0, WALL.roofY, GATE_Z)[1];
  const post = GATE.posts[1]!;
  const inner = P(post[0] - post[3] / 2, 0, GATE_Z)[0];
  const opening = Math.abs(x - P(0, 0, GATE_Z)[0]) < Math.abs(inner - P(0, 0, GATE_Z)[0]);
  const beam = GATE.beams[0]!;
  if (opening && y > P(0, beam[1] - beam[4] / 2, GATE_Z)[1]) return true;
  const rf = GATE.roof;
  const roofL = P(-rf.halfW, rf.eaveY, GATE_Z + rf.depth)[0],
    roofR = P(rf.halfW, rf.eaveY, GATE_Z + rf.depth)[0];
  const ridge = P(0, rf.ridgeY, GATE_Z)[1];
  if (x > roofL && x < roofR) return y < ridge;
  return y < wallTop;
}

/** 隠れる部分で切った後の区間を描く、長さの下限（px）。これより短い区間は、塀の上や柱の際に点のように残るので描かない */
const MIN_RUN = 24;

/**
 * 画面の点の列を、隠れない区間ごとに分ける。
 * 隠れる部分で切った区間のうち、MIN_RUN より短いものは捨てる。全体が見える線は、短くても残す
 */
function visibleRuns(pts: readonly Vec2[]): Vec2[][] {
  const runs: Vec2[][] = [];
  let cur: Vec2[] = [];
  const sampled = sample(pts, 3);
  for (const p of sampled) {
    if (visible(p)) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  const length = (r: readonly Vec2[]) =>
    r.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - r[k]![0], p[1] - r[k]![1]), 0);
  if (runs.length === 1 && runs[0]!.length === sampled.length) return runs;
  return runs.filter((r) => length(r) >= MIN_RUN);
}

const TREE_STROKE = { dry: 0.55, tin: 0.04, tout: 0.25 } as const;

/** 枝の先の葉を描く。松は扇の形、紅葉は丸い弧を重ねた形にする */
function leaves(B: Brush, R: () => number, c: Vec3, r: number, pine: boolean, t0: number): void {
  if (pine) {
    B.needles(c[0], c[1] - r * 0.1, r * 0.8, t0, { layer: "mid", tint: false, clip: visibleRuns });
    return;
  }
  for (let q = 0; q < 4; q++) {
    const cx = c[0] + (R() - 0.5) * r * 1.4,
      cy = c[1] - r * 0.15 + (R() - 0.5) * r * 0.9,
      rr = r * (0.28 + R() * 0.18),
      a0 = Math.PI * (0.9 + R() * 0.3);
    const arc: Vec2[] = [];
    for (let j = 0; j <= 6; j++) {
      const an = a0 + (j / 6) * Math.PI * 1.1;
      arc.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.8]);
    }
    for (const run of visibleRuns(arc))
      B.add("mid", run, { w: 3, a: 0.5, dry: 0.6, tin: 0.1, tout: 0.4, t0: t0 + q * 30, dur: 140 });
  }
}

/** 1 本の木を、幹、枝、葉の順に描く */
function drawTree(B: Brush, R: () => number, tree: InkTree, start: number): void {
  const local = TRUNK.map(([x, y, z]) => [x * tree.dir, y, z] as Vec3);
  const screen = (p: Vec3): Vec3 =>
    project([tree.at[0] + p[0] * tree.s, p[1] * tree.s, tree.at[1] + p[2] * tree.s]);
  const xy = (p: Vec3): Vec2 => {
    const q = screen(p);
    return [q[0], q[1]];
  };
  const px = screen(local[0]!)[2];
  for (const run of visibleRuns(local.map(xy)))
    B.add("mid", run, {
      w: Math.max(3, 0.22 * px * tree.s),
      a: 0.8,
      ...TREE_STROKE,
      t0: start,
      dur: 320,
    });
  TREE_PADS.forEach(([u, dx, oz, size], k) => {
    const a = along(local, u);
    const tip: Vec3 = [a[0] + dx * tree.dir, a[1] + 0.15, a[2] + oz];
    const mid: Vec3 = [(a[0] + tip[0]) / 2, a[1] + 0.25, (a[2] + tip[2]) / 2];
    const bt = start + 220 + k * 70;
    for (const run of visibleRuns([a, mid, tip].map(xy)))
      B.add("mid", run, {
        w: Math.max(2, 0.08 * px * tree.s),
        a: 0.7,
        ...TREE_STROKE,
        t0: bt,
        dur: 180,
      });
    const c = screen(tip);
    leaves(B, R, c, size * tree.s * c[2] * 0.9, tree.pine, bt + 160);
  });
}

/**
 * 立体の庭の木を、最初のカメラで投影した位置に、奥の木から順に、幹、枝、葉の順で描く。
 * 形は、立体の木（scene/scene-parts.ts の tree）と同じ幹の点と枝の位置から作る。
 * @param t0 最初の木を描き始める時刻（ms、試作の時刻の尺度）
 */
export function addTrees(B: Brush, t0: number): void {
  const R = rng(TREE_SEED);
  const trees: InkTree[] = [
    ...OTHER_TREES.map((t) => ({ ...t, pine: true })),
    ...STATIONS.map(({ tree: t }) => ({ at: t.at, s: t.s, dir: t.dir, pine: t.leaf === "pine" })),
  ].sort((a, b) => a.at[1] - b.at[1]);
  trees.forEach((tree, i) => drawTree(B, R, tree, t0 + i * TREE_GAP));
}
