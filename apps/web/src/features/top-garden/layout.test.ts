import { describe, expect, it } from "vitest";
import { CAM0, DESIGN, GATE, GATE_Z, MOUNTAINS, project, ridgeY } from "./layout";

describe("project", () => {
  it("最初のカメラの注視点を、設計の画面の中央に置く", () => {
    const [x, y] = project(CAM0.look);
    expect([Math.round(x), Math.round(y)]).toStrictEqual([DESIGN.w / 2, DESIGN.h / 2]);
  });

  it("遠い点ほど、1 m を小さく描く", () => {
    const near = project([0, 0, GATE_Z])[2];
    const far = project([0, 0, GATE_Z - 10])[2];
    expect(far).toBeLessThan(near);
  });

  it("門の 2 本の柱は、画面の中央を挟んで左右に対称に並ぶ", () => {
    const [l, r] = GATE.posts.map(([x, y, z]) => project([x, y, z])[0]);
    expect(l! + r!).toBeCloseTo(DESIGN.w);
  });
});

describe("ridgeY", () => {
  it("頂から遠い所は、裾の高さになる", () => {
    const m = MOUNTAINS[0]!;
    expect(ridgeY(m, -10000)).toBe(m.base);
  });

  it("頂の真上は、裾から頂の高さだけ上になる", () => {
    const m = { ...MOUNTAINS[0]!, peaks: [[500, 120, 100]] as const };
    expect(ridgeY(m, 500)).toBe(m.base - 120);
  });
});
