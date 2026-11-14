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

/** 点の列の上の位置 u（0〜1）の点。点の間は Catmull-Rom の曲線でつなぐ */
function along(pts: readonly Vec3[], u: number): Vec3 {
  const n = pts.length - 1;
  const f = Math.min(n - 1e-9, Math.max(0, u * n));
  const i = Math.floor(f),
    t = f - i;
  const at = (k: number) => pts[Math.min(n, Math.max(0, k))]!;
  const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const t2 = t * t,
    t3 = t2 * t;
  return [0, 1, 2].map(
    (j) =>
      0.5 *
      (2 * b[j]! +
        (c[j]! - a[j]!) * t +
        (2 * a[j]! - 5 * b[j]! + 4 * c[j]! - d[j]!) * t2 +
        (3 * b[j]! - a[j]! - 3 * c[j]! + d[j]!) * t3),
  ) as unknown as Vec3;
}

/**
 * 最初のカメラで、塀、門の梁、屋根に隠れない画面の点か。
 * 木は塀より奥にあるので、塀の上か、門の柱の間の梁より下だけが見える。
 */
function visible([x, y]: Vec2): boolean {
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

/** 画面の点の列を、隠れない区間ごとに分ける。短すぎる区間は捨てる */
function visibleRuns(pts: readonly Vec2[]): Vec2[][] {
  const runs: Vec2[][] = [];
  let cur: Vec2[] = [];
  for (const p of sample(pts, 3)) {
    if (visible(p)) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 4);
}

const DRY = { dry: 0.55, tin: 0.04, tout: 0.25 } as const;

/** 枝の先の葉を描く。松は扇の形、紅葉は丸い弧を重ねた形にする */
function leaves(B: Brush, R: () => number, c: Vec3, r: number, pine: boolean, t0: number): void {
  if (pine) {
    if (visible([c[0], c[1]]))
      B.needles(c[0], c[1] - r * 0.1, r * 0.8, t0, { layer: "mid", tint: false });
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
    B.add("mid", run, { w: Math.max(3, 0.22 * px * tree.s), a: 0.8, ...DRY, t0: start, dur: 320 });
  TREE_PADS.forEach(([u, dx, oz, size], k) => {
    const a = along(local, u);
    const tip: Vec3 = [a[0] + dx * tree.dir, a[1] + 0.15, a[2] + oz];
    const mid: Vec3 = [(a[0] + tip[0]) / 2, a[1] + 0.25, (a[2] + tip[2]) / 2];
    const bt = start + 220 + k * 70;
    for (const run of visibleRuns([a, mid, tip].map(xy)))
      B.add("mid", run, { w: Math.max(2, 0.08 * px * tree.s), a: 0.7, ...DRY, t0: bt, dur: 180 });
    const c = screen(tip);
    // 立体の葉は、枝の先から葉の広がりの半径に散らばる
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
