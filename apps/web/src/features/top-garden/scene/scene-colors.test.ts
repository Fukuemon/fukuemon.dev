import { Color } from "three";
import { describe, expect, it } from "vitest";
import { SEASON_LEAVES, TIME_PALETTES, mixHex, scenePalette } from "./scene-colors";

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
