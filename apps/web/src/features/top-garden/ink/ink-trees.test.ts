import { describe, expect, it } from "vitest";
import { visible } from "./ink-trees";
import { GATE, GATE_Z, WALL, project } from "../layout";

const center = project([0, 0, GATE_Z])[0];
const wallTop = project([0, WALL.roofY, GATE_Z])[1];
const beam = GATE.beams[0]!;
const beamBottom = project([0, beam[1] - beam[4] / 2, GATE_Z])[1];
const ridge = project([0, GATE.roof.ridgeY, GATE_Z])[1];
const roofRight = project([GATE.roof.halfW, GATE.roof.eaveY, GATE_Z + GATE.roof.depth])[0];

describe("visible", () => {
  it.each([
    ["門の柱の間で、梁より下", [center, beamBottom + 5], true],
    ["門の柱の間で、梁と屋根の棟の間", [center, (beamBottom + ridge) / 2], false],
    ["屋根の上", [center, ridge - 5], true],
    ["屋根の外で、塀より上", [roofRight + 20, wallTop - 5], true],
    ["屋根の外で、塀の面", [roofRight + 20, wallTop + 5], false],
  ] as const)("%s の点が見えるかは %s", (_, p, expected) => {
    expect(visible(p)).toBe(expected);
  });
});
