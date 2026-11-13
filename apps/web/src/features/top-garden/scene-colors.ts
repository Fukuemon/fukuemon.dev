// 場面の色の表。場面のほかでは使わないので、デザインシステムのトークンの対象の外に置く。
// 色の値は、このファイルのほかに書かない。check:raw-values は、このファイルとそのテストを対象から外す。
import type { Season, TimeOfDay } from "./season";

/** 空に描く日か月。位置と半径は、設計の画面（1600 × 900）の px */
interface Orb {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly color: string;
  readonly glow: number;
}

export interface TimePalette {
  readonly skyTop: string;
  readonly sky: string;
  readonly mist: string;
  readonly far: string;
  readonly sand: string;
  readonly rake: string;
  readonly earth: string;
  readonly moss: string;
  readonly mossDark: string;
  readonly stone: string;
  readonly bark: string;
  readonly pine: string;
  readonly pineLight: string;
  readonly wood: string;
  readonly woodLight: string;
  readonly plaster: string;
  readonly roof: string;
  readonly lamp: string;
  readonly paper: string;
  readonly water: string;
  readonly text: string;
  readonly link: string;
  readonly textMist: string;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly sun: string;
  readonly sunI: number;
  readonly hemiI: number;
  readonly sunPos: readonly [number, number, number];
  readonly lampOn: number;
  readonly orb: Orb | null;
}

const DAY: TimePalette = {
  skyTop: "#cfd8d6",
  sky: "#ece8dc",
  mist: "#ebe7db",
  far: "#8f9b95",
  sand: "#e9e3d4",
  rake: "#cdc4ae",
  earth: "#ddd4bf",
  moss: "#72805a",
  mossDark: "#596843",
  stone: "#8d897f",
  bark: "#4a3b2e",
  pine: "#40543a",
  pineLight: "#586c45",
  wood: "#4d3d2f",
  woodLight: "#8a7257",
  plaster: "#eee8da",
  roof: "#45413d",
  lamp: "#ecd08f",
  paper: "#f6f2e7",
  water: "#8fb4b0",
  text: "#1a1714",
  link: "#3d4b2b",
  textMist: "rgba(251, 249, 243, 0.95)",
  hemiSky: "#f6f2e8",
  hemiGround: "#7b785e",
  sun: "#fff1d8",
  sunI: 2.4,
  hemiI: 1.5,
  sunPos: [-8, 12, 6],
  lampOn: 0.3,
  orb: null,
};

/** 時間帯ごとの場面の色と光。値は Design Doc の「時間帯ごとの場面の色」の表と同じ */
export const TIME_PALETTES: Readonly<Record<TimeOfDay, TimePalette>> = {
  morning: {
    ...DAY,
    skyTop: "#d9dbd6",
    sky: "#f5e8d4",
    mist: "#f3eadc",
    far: "#a09f97",
    sun: "#ffe0b0",
    sunI: 2.0,
    hemiI: 1.45,
    sunPos: [10, 6, -5],
    orb: { x: 1170, y: 230, r: 30, color: "#f1cf8e", glow: 0.5 },
  },
  day: DAY,
  evening: {
    ...DAY,
    skyTop: "#c2bbbd",
    sky: "#edcfae",
    mist: "#ead3ba",
    far: "#9a8c88",
    sand: "#e6dac6",
    plaster: "#ecdfca",
    sun: "#ffb37a",
    sunI: 2.2,
    hemiI: 1.25,
    sunPos: [-11, 4.5, -3],
    lampOn: 0.8,
    orb: { x: 330, y: 250, r: 40, color: "#d5683f", glow: 0.45 },
  },
  night: {
    skyTop: "#0c121c",
    sky: "#1f3858",
    mist: "#22324a",
    far: "#34475f",
    sand: "#6a7078",
    rake: "#565c64",
    earth: "#5b5f63",
    moss: "#2c3724",
    mossDark: "#1f2819",
    stone: "#4f545a",
    bark: "#1e1813",
    pine: "#24342a",
    pineLight: "#31453a",
    wood: "#17110c",
    woodLight: "#3a2e22",
    plaster: "#5d5a55",
    roof: "#101216",
    lamp: "#ecd08f",
    paper: "#2b303b",
    water: "#27405e",
    text: "#f4f1ea",
    link: "#b9cca3",
    textMist: "rgba(18, 24, 34, 0.92)",
    hemiSky: "#8ea4c6",
    hemiGround: "#1a1f17",
    sun: "#a9bce6",
    sunI: 1.5,
    hemiI: 2.3,
    sunPos: [-6, 12, 5],
    lampOn: 1,
    orb: { x: 640, y: 150, r: 34, color: "#ecd08f", glow: 0.55 },
  },
};

export type LeafShape = "petal" | "momiji";

/** 季節の木の葉。冬は葉を描かず、枝だけにする */
export const SEASON_LEAVES: Readonly<
  Record<Season, { readonly colors: readonly string[]; readonly shape: LeafShape } | null>
> = {
  spring: { colors: ["#e3a5b6", "#f0c4cf", "#f6dbe1"], shape: "petal" },
  summer: { colors: ["#56743d", "#6f8d4e", "#88a262"], shape: "momiji" },
  autumn: { colors: ["#a83c26", "#c65a2e", "#d98a3c"], shape: "momiji" },
  winter: null,
};

/** canvas に描く、色を持たない形の塗り。テクスチャの色は、材質の色で付ける */
export const SHAPE_FILL = "#ffffff";
/** canvas のグラデーションの、透明の端 */
export const CLEAR = "rgba(0, 0, 0, 0)";

const SNOW = "#ffffff";
const NIGHT_LEAF = "#10151c";

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const channels = (hex: string) =>
  [1, 3, 5].map((i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255));

/**
 * 2 つの 16 進の色を、k の割合で混ぜる。three の Color.lerp と同じく、リニアの色空間で混ぜる。
 * @param a `#rrggbb`
 * @param b `#rrggbb`
 */
export function mixHex(a: string, b: string, k: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return (
    "#" +
    ca
      .map((v, i) => {
        const s = toSrgb(v + (cb[i]! - v) * k);
        return Math.round(Math.min(1, Math.max(0, s)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/** 時間帯の表と季節の表を掛け合わせた、場面の色 */
export interface ScenePalette extends TimePalette {
  /** 季節の木の葉。冬は null */
  readonly leaf: { readonly colors: readonly string[]; readonly shape: LeafShape } | null;
  /** 苔の暗い所に散らす色。冬は雪の色にする */
  readonly mossSpeck: string;
}

/**
 * 時間帯と季節から、場面の色を決める。
 * 冬は白砂と苔に雪の色を混ぜ、夜は季節の木の葉を暗くする。
 */
export function scenePalette(time: TimeOfDay, season: Season): ScenePalette {
  const c = TIME_PALETTES[time];
  const leaf = SEASON_LEAVES[season];
  const winter = season === "winter";
  return {
    ...c,
    sand: winter ? mixHex(c.sand, SNOW, 0.55) : c.sand,
    moss: winter ? mixHex(c.moss, SNOW, 0.6) : c.moss,
    mossSpeck: winter ? SNOW : c.mossDark,
    leaf: leaf && {
      shape: leaf.shape,
      colors: time === "night" ? leaf.colors.map((x) => mixHex(x, NIGHT_LEAF, 0.3)) : leaf.colors,
    },
  };
}
