// 門と庭の配置。墨の絵と、立体の場面の両方が読む。
// 墨の門の線を、立体の門を最初のカメラで投影して作るので、色が差すときに位置がずれない。

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
/** [中心 x, y, z, 幅, 高さ, 奥行き]（m） */
type Box = readonly [number, number, number, number, number, number];

/** 設計の画面の大きさ（px）と、最初のカメラの縦の画角（度） */
export const DESIGN = { w: 1600, h: 900, fov: 46 } as const;
export const CAM0: { readonly pos: Vec3; readonly look: Vec3 } = {
  pos: [0, 1.55, 9.5],
  look: [0, 1.55, 0],
};
export const GATE_Z = 3;

export interface Gate {
  readonly posts: readonly Box[];
  readonly beams: readonly Box[];
  readonly arms: readonly Box[];
  readonly ridge: Box;
  readonly roof: {
    readonly halfW: number;
    readonly ridgeY: number;
    readonly eaveY: number;
    readonly depth: number;
  };
  readonly door: { readonly x: number; readonly h: number; readonly len: number };
}

export const GATE: Gate = {
  posts: [
    [-1.25, 1.25, GATE_Z, 0.26, 2.5, 0.26],
    [1.25, 1.25, GATE_Z, 0.26, 2.5, 0.26],
  ],
  beams: [[0, 2.3, GATE_Z, 2.24, 0.2, 0.2]],
  arms: [
    [-1.25, 2.56, GATE_Z, 0.18, 0.14, 2.0],
    [1.25, 2.56, GATE_Z, 0.18, 0.14, 2.0],
  ],
  ridge: [0, 3.4, GATE_Z, 4.7, 0.14, 0.2],
  roof: { halfW: 2.3, ridgeY: 3.36, eaveY: 2.62, depth: 1.15 },
  door: { x: 1.1, h: 2.1, len: 1.05 },
};

export const WALL = { x0: 1.38, x1: 16, h: 1.7, roofY: 1.82, t: 0.3 } as const;
/** 飛び石の中心の [x, z] */
export const STEPS: readonly Vec2[] = [
  [0.16, 8.3],
  [-0.18, 7.1],
  [0.14, 5.95],
  [-0.12, 4.8],
  [0, 3.55],
  [0.15, 2.2],
  [-0.16, 0.9],
  [0.12, -0.4],
];
export const STEP_R = 0.42;

/** 山の頂の [x, 高さ, 裾の広さ]（px） */
export type Peak = readonly [number, number, number];

export interface Mountain {
  readonly peaks: readonly Peak[];
  readonly base: number;
  readonly x0: number;
  readonly x1: number;
  readonly n: number;
  readonly alpha: number;
  readonly t0: number;
}

// 遠景の山並み。SVG の座標（1600×900）で書き、立体の場面では、最初のカメラから同じ位置に見える板に描く。
export const MOUNTAINS: readonly Mountain[] = [
  {
    peaks: [
      [210, 190, 190],
      [520, 120, 160],
      [800, 60, 170],
    ],
    base: 428,
    x0: -80,
    x1: 1040,
    n: 9,
    alpha: 0.1,
    t0: 0,
  },
  {
    peaks: [
      [1010, 130, 240],
      [1380, 175, 220],
    ],
    base: 420,
    x0: 660,
    x1: 1680,
    n: 8,
    alpha: 0.06,
    t0: 260,
  },
];
/**
 * 立体の点を、最初のカメラで設計の画面の座標に投影する。
 * @returns [x, y, 1 m が何 px に当たるか]
 */
export function project([x, y, z]: Vec3): Vec3 {
  // 最初のカメラは水平に -z を向くので、投影は割り算だけで済む。
  const d = CAM0.pos[2] - z;
  const k = DESIGN.h / 2 / Math.tan((DESIGN.fov * Math.PI) / 360);
  return [
    DESIGN.w / 2 + ((x - CAM0.pos[0]) / d) * k,
    DESIGN.h / 2 - ((y - CAM0.pos[1]) / d) * k,
    k / d,
  ];
}
