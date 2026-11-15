// 季節の舞う物（春の桜、夏の蛍、秋の紅葉、冬の雪）。全てを 1 つの InstancedMesh にして、1 回の描画の呼び出しで描く。
// 動きの式と乱数の順は、試作の docs/design/prototypes/top/src/i-scene.js と同じにしてある。
import {
  AdditiveBlending,
  type Camera,
  DoubleSide,
  InstancedMesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
} from "three";
import { rng } from "../rng";
import type { ScenePalette } from "./scene-colors";
import { shapeTexture } from "./scene-parts";

/** 舞う物が上から下へ抜ける高さ（m）。下の端まで来た物は、上の端に戻る */
const FALL_H = 5.2;

export interface Falling {
  readonly mesh: InstancedMesh;
  /**
   * 描き始めてから `sec` 秒たった時点の位置に置く。蛍と雪は、板をカメラに向ける。
   * カメラの向きを決めた後、描く前に呼ぶ。
   */
  place(sec: number, camera: Camera): void;
}

/** `fall` の数の舞う物を作る。場面の乱数と別の種を使うので、場面の物の配置を変えない */
export function createFalling(fall: NonNullable<ScenePalette["fall"]>): Falling {
  const glow = fall.shape === "glow";
  const snow = fall.shape === "flake";
  const mesh = new InstancedMesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      color: fall.color,
      map: shapeTexture(fall.shape),
      transparent: true,
      alphaTest: glow ? 0 : 0.5,
      side: DoubleSide,
      depthWrite: false,
      fog: !glow,
      blending: fall.additive ? AdditiveBlending : NormalBlending,
    }),
    fall.count,
  );
  mesh.frustumCulled = false;
  const R = rng(5);
  const seeds = Array.from({ length: fall.count }, () => ({
    x: -8 + R() * 16,
    z: -12 + R() * 16,
    p: R(),
    v: 0.6 + R() * 0.6,
    s: 0.6 + R() * 0.7,
    a: R() * 7,
  }));
  const d = new Object3D();

  return {
    mesh,
    place(sec, camera) {
      seeds.forEach((q, i) => {
        if (glow) {
          d.position.set(
            q.x * 0.8 + Math.sin(sec * 0.3 * q.v + q.a) * 0.6,
            0.5 + q.p * 1.4 + Math.sin(sec * 0.5 + q.a * 2) * 0.2,
            q.z * 0.8 - 2 + Math.cos(sec * 0.25 + q.a) * 0.6,
          );
          d.quaternion.copy(camera.quaternion);
          // 明滅させる。光が消える間も、0.35 倍の大きさは残す
          d.scale.setScalar(
            0.42 * q.s * (0.35 + 0.65 * Math.max(0, Math.sin(sec * 1.3 * q.v + q.a))),
          );
        } else {
          const speed = snow ? 0.42 : 0.55;
          const y = FALL_H - ((sec * speed * q.v + q.p * FALL_H) % FALL_H);
          d.position.set(
            q.x + Math.sin(sec * 0.9 * q.v + q.a) * (snow ? 0.15 : 0.45),
            y,
            q.z + Math.cos(sec * 0.7 + q.a) * 0.25,
          );
          if (snow) d.quaternion.copy(camera.quaternion);
          else d.rotation.set(sec * 1.7 * q.v + q.a, sec * 1.1 + q.a, q.a);
          d.scale.setScalar((snow ? 0.045 : 0.13) * q.s);
        }
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
