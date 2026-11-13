// 和紙を、上下の軸木と 2 本の紐で、木から伸びる枝に掛ける。
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  type Scene,
  TubeGeometry,
  Vector3,
} from "three";
import type { Station } from "../layout";
import type { ScenePalette } from "./scene-colors";

/** 紐の長さ（m） */
const CORD = 0.42;

/**
 * 和紙と軸木と紐を組み、`tree` から和紙の上の両端へ枝を伸ばして、`scene` に足す。
 * @param pw 和紙の幅（m）
 * @param ph 和紙の高さ（m）
 * @param tree 和紙を掛ける木。`userData.top` に、枝を伸ばし始める点を持つ
 */
export function hangPaper(
  scene: Scene,
  C: Pick<ScenePalette, "paper" | "wood" | "bark">,
  st: Station,
  pw: number,
  ph: number,
  tree: Group,
): void {
  const wood = new MeshLambertMaterial({ color: C.wood });
  const g = new Group();
  const paper = new Mesh(new PlaneGeometry(pw, ph), new MeshBasicMaterial({ color: C.paper }));
  paper.position.z = -0.015;
  g.add(paper);
  for (const k of [1, -1]) {
    const rod = new Mesh(new CylinderGeometry(0.028, 0.028, pw + 0.14, 8), wood);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, (k * ph) / 2, -0.015);
    rod.castShadow = true;
    g.add(rod);
    const cord = new Mesh(new BoxGeometry(0.012, CORD, 0.012), wood);
    cord.position.set(k * (pw / 2 - 0.1), ph / 2 + CORD / 2, -0.015);
    g.add(cord);
  }
  g.position.set(...st.pos);
  g.rotation.y = st.rot;
  scene.add(g);

  const center = new Vector3(...st.pos);
  const right = new Vector3(Math.cos(st.rot), 0, -Math.sin(st.rot));
  const y = st.pos[1] + ph / 2 + CORD;
  const ends = [-1, 1].map((k) =>
    center
      .clone()
      .addScaledVector(right, k * (pw / 2 + 0.25))
      .setY(y),
  ) as [Vector3, Vector3];
  const from = tree.position.clone().add(tree.userData.top as Vector3);
  if (from.distanceTo(ends[0]) > from.distanceTo(ends[1])) ends.reverse();
  const curve = new CatmullRomCurve3([
    from,
    from
      .clone()
      .lerp(ends[0], 0.55)
      .add(new Vector3(0, 0.22, 0)),
    ends[0],
    ends[1].clone().add(new Vector3(0, 0.05, 0)),
  ]);
  const bough = new Mesh(
    new TubeGeometry(curve, 24, 0.032, 6),
    new MeshLambertMaterial({ color: C.bark }),
  );
  bough.castShadow = true;
  scene.add(bough);
}
