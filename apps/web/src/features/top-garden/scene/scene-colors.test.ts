import { Color } from "three";
import { describe, expect, it } from "vitest";
import { SEASON_LEAVES, TIME_PALETTES, mixHex, scenePalette } from "./scene-colors";
import type { TimeOfDay } from "../stage/season";

/** WCAG 2.2 の相対輝度。three の Color は、16 進数を sRGB から線形に直して持つ */
const luminance = (hex: string) => {
  const c = new Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

describe("mixHex", () => {
  it.each([
    ["#e9e3d4", "#ffffff", 0.55],
    ["#72805a", "#ffffff", 0.6],
    ["#a83c26", "#10151c", 0.3],
    ["#40543a", "#586c45", 0.5],
    ["#000000", "#0a0a0a", 0.5],
  ])("%s と %s を %s で混ぜると、three の Color.lerp と同じ色になる", (a, b, k) => {
    expect(mixHex(a, b, k)).toBe("#" + new Color(a).lerp(new Color(b), k).getHexString());
  });
});

describe("scenePalette", () => {
  it("秋の昼は、昼の表の色と秋の葉をそのまま使う", () => {
    expect(scenePalette("day", "autumn")).toStrictEqual({
      ...TIME_PALETTES.day,
      mossSpeck: TIME_PALETTES.day.mossDark,
      leaf: SEASON_LEAVES.autumn,
    });
  });

  it("冬は、季節の木の葉を描かず、白砂と苔に雪の色を混ぜ、苔に雪を散らす", () => {
    const { sand, moss, mossSpeck, leaf } = scenePalette("day", "winter");
    expect({ sand, moss, mossSpeck, leaf }).toStrictEqual({
      sand: mixHex(TIME_PALETTES.day.sand, "#ffffff", 0.55),
      moss: mixHex(TIME_PALETTES.day.moss, "#ffffff", 0.6),
      mossSpeck: "#ffffff",
      leaf: null,
    });
  });

  it("夜は、季節の木の葉の色に #10151c を 30% 混ぜる", () => {
    expect(scenePalette("night", "spring").leaf).toStrictEqual({
      shape: "petal",
      colors: SEASON_LEAVES.spring!.colors.map((c) => mixHex(c, "#10151c", 0.3)),
    });
  });

  it("夜のほかの時間帯は、季節の木の葉の色を変えない", () => {
    expect(scenePalette("evening", "summer").leaf).toStrictEqual(SEASON_LEAVES.summer);
  });
});

describe("和紙の字の色", () => {
  const times: readonly TimeOfDay[] = ["morning", "day", "evening", "night"];
  const cases = times.flatMap((t) => (["text", "link"] as const).map((k) => [t, k] as const));

  // 和紙の色はテーマに依らないので、4 つの時間帯で、2 つのテーマとの組み合わせの 8 通りを覆う
  it.each(cases)("%s の和紙の %s の色は、和紙の地に対して 4.5:1 以上である", (t, k) => {
    expect(contrast(TIME_PALETTES[t][k], TIME_PALETTES[t].paper)).toBeGreaterThanOrEqual(4.5);
  });
});
