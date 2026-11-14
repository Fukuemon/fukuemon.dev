import { CatmullRomCurve3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { along, visible } from "./ink-trees";
import { GATE, GATE_Z, TRUNK, WALL, project } from "../layout";

const center = project([0, 0, GATE_Z])[0];
const wallTop = project([0, WALL.roofY, GATE_Z])[1];
const beam = GATE.beams[0]!;
const beamBottom = project([0, beam[1] - beam[4] / 2, GATE_Z])[1];
const ridge = project([0, GATE.roof.ridgeY, GATE_Z])[1];
const roofLeft = project([-GATE.roof.halfW, GATE.roof.eaveY, GATE_Z + GATE.roof.depth])[0];
const roofRight = project([GATE.roof.halfW, GATE.roof.eaveY, GATE_Z + GATE.roof.depth])[0];
const post = GATE.posts[1]!;
const postInner = project([post[0] - post[3] / 2, 0, GATE_Z])[0];

describe("visible", () => {
  it.each([
    ["門の柱の間で、梁より下の点は見える", [center, beamBottom + 5], true],
    ["門の柱の間で、梁と屋根の棟の間の点は見えない", [center, (beamBottom + ridge) / 2], false],
    ["屋根の上の点は見える", [center, ridge - 5], true],
    ["屋根の右の外で、塀より上の点は見える", [roofRight + 20, wallTop - 5], true],
    ["屋根の左の外で、塀より上の点は見える", [roofLeft - 20, wallTop - 5], true],
    ["屋根の外で、塀の面の点は見えない", [roofRight + 20, wallTop + 5], false],
    ["門の柱の外で、屋根の下の梁より下の点は見えない", [postInner + 30, beamBottom + 5], false],
  ] as const)("%s", (_, p, expected) => {
    expect(visible(p)).toBe(expected);
  });
});

describe("along", () => {
  const curve = new CatmullRomCurve3(TRUNK.map(([x, y, z]) => new Vector3(x, y, z)));
  it.each([0, 0.3, 0.55, 0.68, 0.8, 0.92, 1])(
    "幹の上の位置 %s の点は、立体の木の幹の CatmullRomCurve3 の getPoint と同じ点である",
    (u) => {
      const [x, y, z] = along(TRUNK, u);
      expect(curve.getPoint(u).distanceTo(new Vector3(x, y, z))).toBeLessThan(1e-9);
    },
  );
});
