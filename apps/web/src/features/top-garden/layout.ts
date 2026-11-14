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
  /** 柱の上から前後に張り出す腕木 */
  readonly arms: readonly Box[];
  /** 屋根の棟 */
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

/** 門の左右の塀。x0 から x1 までの左右対称で、h は高さ、t は厚さ（m） */
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

/** 遠景の山並み。SVG の座標（1600×900）で書き、立体の場面では、最初のカメラから同じ位置に見える板に描く。 */
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
/** 遠景の山並みを描く板の z（m） */
export const FAR_Z = -60;

/** 山並みの稜線の、設計の画面での y（px） */
export function ridgeY(m: Pick<Mountain, "peaks" | "base">, x: number): number {
  return m.base - m.peaks.reduce((s, p) => s + p[1] * Math.exp(-(((x - p[0]) / p[2]) ** 2)), 0);
}

/** 3D の場面の 1 m に当たる、和紙の文の px */
export const PX = 260;
/** 和紙の、文の外の余白の合計（m）。左右に 0.18 m、上下に 0.2 m */
export const PAPER_PAD = { w: 0.36, h: 0.4 } as const;

/** 池。中心の x と z、楕円の半径、y 軸の回りの回転（ラジアン） */
export const POND = { x: 4.9, z: -6.3, rx: 2.7, rz: 1.8, rot: -0.4 } as const;

export interface Station {
  /** トップのプロフィールのセクションの id */
  readonly id: string;
  readonly label: string;
  /** 和紙の中心 */
  readonly pos: Vec3;
  /** 和紙の向き。y 軸の回り（ラジアン） */
  readonly rot: number;
  /** 和紙を掛ける木。根元の [x, z]、大きさ、幹の傾く向き、葉の種類 */
  readonly tree: {
    readonly at: Vec2;
    readonly s: number;
    readonly dir: 1 | -1;
    readonly leaf: "pine" | "season";
  };
}

/** 和紙を掛けない庭の木。根元の [x, z]、大きさ、幹の傾く向き。どちらも松である */
export const OTHER_TREES: readonly {
  readonly at: Vec2;
  readonly s: number;
  readonly dir: 1 | -1;
}[] = [
  { at: [-9.0, -11.2], s: 1.35, dir: 1 },
  { at: [6.4, -1.4], s: 1.0, dir: -1 },
];

/** 木の幹の中心線の点。大きさが 1 で、幹が +x へ傾く（dir が 1）ときの値で、x に dir を掛けて使う */
export const TRUNK: readonly Vec3[] = [
  [0, -0.1, 0],
  [0.12, 0.7, 0],
  [-0.15, 1.5, 0.1],
  [0.35, 2.3, 0],
  [0.9, 2.9, -0.1],
];

/** 木の枝。[幹の上の位置（0〜1）, 枝の先の x のずれ（dir を掛ける）, z のずれ, 葉の広がり] */
export const TREE_PADS: readonly (readonly [number, number, number, number])[] = [
  [0.55, 1.2, 0.25, 0.9],
  [0.68, -0.9, 0.1, 0.75],
  [0.8, 1.6, -0.2, 1.0],
  [0.92, 0.2, 0.35, 0.7],
  [1, 1.25, 0.05, 0.8],
];

/** 和紙を掛ける 4 つの場所。プロフィールのセクションの順に並ぶ */
export const STATIONS: readonly Station[] = [
  {
    id: "profile",
    label: "プロフィール",
    pos: [-1.3, 1.5, -2.4],
    rot: 0.25,
    tree: { at: [-3.3, -3.2], s: 1.3, dir: 1, leaf: "pine" },
  },
  {
    id: "career",
    label: "経歴",
    pos: [-4.3, 1.5, -7.0],
    rot: 0.5,
    tree: { at: [-6.4, -7.9], s: 1.4, dir: 1, leaf: "season" },
  },
  {
    id: "stack",
    label: "技術スタック",
    pos: [3.5, 1.5, -4.7],
    rot: -0.45,
    tree: { at: [5.9, -4.2], s: 1.25, dir: -1, leaf: "pine" },
  },
  {
    id: "articles",
    label: "記事",
    pos: [0.4, 1.45, -10.6],
    rot: -0.1,
    tree: { at: [2.6, -11.3], s: 1.5, dir: -1, leaf: "season" },
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
