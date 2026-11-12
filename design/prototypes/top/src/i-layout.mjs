// 門と庭の配置。墨の絵（ビルドのときに SVG にする）と、立体の場面の両方が読む。
// 墨の門の線を、立体の門を最初のカメラで投影して作るので、色が差すときに位置がずれない。
export const DESIGN = { w: 1600, h: 900, fov: 46 };
export const CAM0 = { pos: [0, 1.55, 9.5], look: [0, 1.55, 0] };
export const GATE_Z = 3;

// 箱は [中心 x, y, z, 幅, 高さ, 奥行き]。
export const GATE = {
  posts: [[-1.25, 1.25, GATE_Z, 0.26, 2.5, 0.26], [1.25, 1.25, GATE_Z, 0.26, 2.5, 0.26]],
  beams: [[0, 2.3, GATE_Z, 2.24, 0.2, 0.2]],
  arms: [[-1.25, 2.56, GATE_Z, 0.18, 0.14, 2.0], [1.25, 2.56, GATE_Z, 0.18, 0.14, 2.0]],
  ridge: [0, 3.4, GATE_Z, 4.7, 0.14, 0.2],
  roof: { halfW: 2.3, ridgeY: 3.36, eaveY: 2.62, depth: 1.15 },
  door: { x: 1.1, h: 2.1, len: 1.05 },
};
export const WALL = { x0: 1.38, x1: 16, h: 1.7, roofY: 1.82, t: 0.3 };
export const STEPS = [[0.16, 8.3], [-0.18, 7.1], [0.14, 5.95], [-0.12, 4.8], [0, 3.55], [0.15, 2.2], [-0.16, 0.9], [0.12, -0.4]];
export const STEP_R = 0.42;

// 遠景の山並み。SVG の座標（1600×900）で書き、立体の場面では、最初のカメラから同じ位置に見える板に描く。
export const MOUNTAINS = [
  { peaks: [[210, 190, 190], [520, 120, 160], [800, 60, 170]], base: 428, x0: -80, x1: 1040, n: 9, alpha: 0.1, t0: 0 },
  { peaks: [[1010, 130, 240], [1380, 175, 220]], base: 420, x0: 660, x1: 1680, n: 8, alpha: 0.06, t0: 260 },
];
export const FAR_Z = -60;

export const ridgeY = (m, x) => m.base - m.peaks.reduce((s, p) => s + p[1] * Math.exp(-Math.pow((x - p[0]) / p[2], 2)), 0);

// 最初のカメラは水平に -z を向くので、投影は割り算だけで済む。
export function project([x, y, z]) {
  const d = CAM0.pos[2] - z, k = DESIGN.h / 2 / Math.tan((DESIGN.fov * Math.PI) / 360);
  return [DESIGN.w / 2 + ((x - CAM0.pos[0]) / d) * k, DESIGN.h / 2 - ((y - CAM0.pos[1]) / d) * k, k / d];
}

// 文の置き場。pos は文の中心、rot は y 軸の回り（ラジアン）。kind の scroll は、木の枝に掛けた和紙である。
// scroll の tree は、和紙を掛ける木の根元の x と z、大きさ、傾く向き、葉の種類。
export const POND = { x: 4.9, z: -6.3, rx: 2.7, rz: 1.8, rot: -0.4 };
export const STATIONS = [
  { id: "nanori", label: "名乗り", kind: "scroll", pos: [-1.3, 1.5, -2.4], rot: 0.25, tree: { at: [-3.3, -3.2], s: 1.3, dir: 1, leaf: "pine" } },
  { id: "keireki", label: "経歴", kind: "scroll", pos: [-4.3, 1.5, -7.0], rot: 0.5, tree: { at: [-6.4, -7.9], s: 1.4, dir: 1, leaf: "season" } },
  { id: "gijutsu", label: "技術", kind: "scroll", pos: [3.5, 1.5, -4.7], rot: -0.45, tree: { at: [5.9, -4.2], s: 1.25, dir: -1, leaf: "pine" } },
  { id: "yomimono", label: "読み物", kind: "scroll", pos: [0.4, 1.45, -10.6], rot: -0.1, tree: { at: [2.6, -11.3], s: 1.5, dir: -1, leaf: "season" } },
];
