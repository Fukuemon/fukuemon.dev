import { describe, expect, it } from "vitest";
import { inkArt } from "./ink-art";
import { TIME_SCALE } from "./ink-svg";
import { INK_END, SIGN_LEAD } from "../intro-timing";
import { GATE, GATE_Z, WALL, project } from "../layout";

describe("inkArt", () => {
  it("同じ種からは同じ線のデータができる", () => {
    expect(inkArt(7)).toStrictEqual(inkArt(7));
  });

  it("違う種からは違う線のデータができる", () => {
    expect(inkArt(8)).not.toStrictEqual(inkArt(7));
  });

  it("試作の 281 本の線に、木の線を足した数の線を作る", () => {
    expect(inkArt().strokes).toHaveLength(399);
  });

  const last = () =>
    Math.max(...inkArt().strokes.map((s) => (s.t0 + s.dur) * TIME_SCALE)) + SIGN_LEAD;

  it("墨の絵の最後の線は、INK_END より前に描き終える", () => {
    expect(INK_END - last()).toBeGreaterThanOrEqual(0);
  });

  it("墨の絵の最後の線を描き終えてから INK_END までは、0.3 秒より短い", () => {
    expect(INK_END - last()).toBeLessThan(300);
  });

  it("木の線は、塀の上か門の柱の間にだけあり、塀の面に重ならない", () => {
    const wallTop = project([0, WALL.roofY, GATE_Z])[1];
    const inner = project([GATE.posts[1]![0] - GATE.posts[1]![3] / 2, 0, GATE_Z])[0];
    const center = project([0, 0, GATE_Z])[0];
    const half = inner - center;
    const onWall = inkArt()
      .strokes.slice(281)
      .flatMap((s) => s.p)
      .filter(([x, y]) => y > wallTop + 3 && Math.abs(x - center) > half + 3);
    expect(onWall).toStrictEqual([]);
  });
});
