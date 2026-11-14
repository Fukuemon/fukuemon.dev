// 場面に置く物を作る関数。石、木、灯籠は、後から絵やモデルに差し替えられるよう、Group か Mesh を返す関数にしてある。
import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { SHAPE_FILL, type LeafShape } from "./scene-colors";

/**
 * canvas に描いた絵をテクスチャにする。
 * @param mip true のときだけミップマップを作る。斜めから見る地面のように、遠くで細かい模様が乱れる物に使う
 */
export function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  mip = false,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (!mip) {
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
  }
  return t;
}

type PartShape = LeafShape | "fan";

/** 葉の形の板のテクスチャ。fan は松の針を扇に広げた形、petal は桜の花びら、momiji は紅葉 */
function shapeTexture(shape: PartShape): CanvasTexture {
  return canvasTexture(64, 64, (g, w) => {
    g.translate(w / 2, w / 2);
    g.fillStyle = SHAPE_FILL;
    if (shape === "fan") {
      g.strokeStyle = SHAPE_FILL;
      g.lineWidth = 2.2;
      g.lineCap = "round";
      for (let k = 0; k < 15; k++) {
        const an = -Math.PI * (0.08 + 0.84 * (k / 14));
        g.beginPath();
        g.moveTo(0, 26);
        g.lineTo(Math.cos(an) * 30, 26 + Math.sin(an) * 54);
        g.stroke();
      }
    } else if (shape === "petal") {
      g.beginPath();
      g.moveTo(0, 28);
      g.bezierCurveTo(-22, 10, -18, -18, -5, -28);
      g.lineTo(0, -20);
      g.lineTo(5, -28);
      g.bezierCurveTo(18, -18, 22, 10, 0, 28);
      g.fill();
    } else {
      const len = [13, 21, 26, 30, 26, 21, 13];
      g.beginPath();
      g.moveTo(0, 8);
      for (let k = 0; k < 7; k++) {
        const an = ((-90 + (k - 3) * 37) * Math.PI) / 180;
        for (const [da, r] of [
          [-0.2, 0.42],
          [0, 1],
          [0.2, 0.42],
        ] as const) {
          g.lineTo(Math.cos(an + da) * len[k]! * r, Math.sin(an + da) * len[k]! * r);
        }
      }
      g.fill();
    }
  });
}

/** 石。球の頂点を乱数でずらし、面を平らに塗って角を立てる */
export function rock(rand: () => number, color: string, sx: number, sy: number, sz: number): Mesh {
  const geo = new SphereGeometry(1, 9, 7);
  const p = geo.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const k = 0.86 + rand() * 0.24;
    p.setXYZ(i, p.getX(i) * k, Math.max(p.getY(i), -0.35) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ color, flatShading: true }));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface TreeLeaf {
  readonly shape: PartShape;
  readonly colors: readonly string[];
}

interface Tree {
  readonly group: Group;
  /** 和紙を掛ける枝を伸ばし始める幹の点。木の原点からの位置（m） */
  readonly boughFrom: Vector3;
}

/**
 * 木。幹と枝は管で、葉は葉の形の小さな板を枝の先に集めて描く。
 * @param s 大きさの倍率
 * @param dir 幹の傾く向き
 * @param leaf 葉。null のときは枝だけにする
 */
export function tree(
  rand: () => number,
  bark: string,
  s: number,
  dir: 1 | -1,
  leaf: TreeLeaf | null,
): Tree {
  const g = new Group();
  const barkMat = new MeshLambertMaterial({ color: bark });
  const trunk = new CatmullRomCurve3([
    new Vector3(0, -0.1, 0),
    new Vector3(0.12 * dir, 0.7, 0),
    new Vector3(-0.15 * dir, 1.5, 0.1),
    new Vector3(0.35 * dir, 2.3, 0),
    new Vector3(0.9 * dir, 2.9, -0.1),
  ]);
  const t = new Mesh(new TubeGeometry(trunk, 32, 0.11, 7), barkMat);
  t.castShadow = true;
  g.add(t);
  // [幹の上の位置, 枝の先の x, z のずれ, 葉の広がり]
  const pads = [
    [0.55, 1.2 * dir, 0.25, 0.9],
    [0.68, -0.9 * dir, 0.1, 0.75],
    [0.8, 1.6 * dir, -0.2, 1.0],
    [0.92, 0.2 * dir, 0.35, 0.7],
    [1, 1.25 * dir, 0.05, 0.8],
  ] as const;
  const spots: [number, number, number, number][] = [];
  const pine = leaf?.shape === "fan";
  for (const [u, ox, oz, size] of pads) {
    const a = trunk.getPoint(u);
    const end = new Vector3(a.x + ox, a.y + 0.15, a.z + oz);
    const mid = new Vector3((a.x + end.x) / 2, a.y + 0.25, (a.z + end.z) / 2);
    const br = new Mesh(
      new TubeGeometry(new CatmullRomCurve3([a, mid, end]), 10, 0.035, 5),
      barkMat,
    );
    br.castShadow = true;
    g.add(br);
    for (let k = 0; k < 3; k++) {
      const tip = new Vector3(
        end.x + (rand() - 0.5) * size * 0.9,
        end.y + 0.1 + rand() * size * (pine ? 0.1 : 0.4),
        end.z + (rand() - 0.5) * size * 0.7,
      );
      const twig = new CatmullRomCurve3([mid.clone().lerp(end, 0.4 + rand() * 0.5), tip]);
      g.add(new Mesh(new TubeGeometry(twig, 4, 0.016, 4), barkMat));
    }
    const n = pine ? 34 : 110;
    for (let i = 0; i < n; i++) {
      const an = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand());
      spots.push([
        end.x + Math.cos(an) * rr * size * (pine ? 0.95 : 0.8),
        end.y + (pine ? 0.02 + rand() * 0.16 : (rand() - 0.25) * size * 0.75),
        end.z + Math.sin(an) * rr * size * (pine ? 0.6 : 0.65),
        (pine ? 0.42 : 0.2) * (0.75 + rand() * 0.5),
      ]);
    }
  }
  if (leaf) {
    const mat = new MeshLambertMaterial({
      map: shapeTexture(leaf.shape),
      alphaTest: 0.4,
      side: DoubleSide,
    });
    const m = new InstancedMesh(new PlaneGeometry(1, 1), mat, spots.length);
    const d = new Object3D();
    const col = new Color(); // design-system-allow: three の Color のコンストラクタで、色の値ではない
    spots.forEach(([x, y, z, k], i) => {
      d.position.set(x, y, z);
      if (pine) d.rotation.set((rand() - 0.5) * 0.7, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
      else d.rotation.set(rand() * 6.3, rand() * 6.3, rand() * 6.3);
      d.scale.setScalar(k);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, col.set(leaf.colors[Math.floor(rand() * leaf.colors.length)]!));
    });
    m.frustumCulled = false;
    g.add(m);
  }
  g.scale.setScalar(s);
  return { group: g, boughFrom: trunk.getPoint(0.86).multiplyScalar(s) };
}

/**
 * 石灯籠。火袋の窓だけを、明かりの色で光らせる。
 * @param lampOn 明かりの強さ（0〜1）
 */
export function lantern(stone: string, lamp: string, lampOn: number): Group {
  const g = new Group();
  const st = new MeshLambertMaterial({ color: stone, flatShading: true });
  const parts = [
    [new CylinderGeometry(0.26, 0.3, 0.12, 6), 0.06],
    [new CylinderGeometry(0.08, 0.1, 0.62, 8), 0.43],
    [new CylinderGeometry(0.28, 0.2, 0.1, 6), 0.79],
    [new BoxGeometry(0.3, 0.28, 0.3), 0.98],
    [new ConeGeometry(0.46, 0.26, 6), 1.25],
    [new SphereGeometry(0.06, 8, 6), 1.42],
  ] as const;
  for (const [geo, y] of parts) {
    const m = new Mesh(geo, st);
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  }
  const win = new Mesh(
    new PlaneGeometry(0.15, 0.16),
    new MeshBasicMaterial({ color: lamp, transparent: true, opacity: lampOn }),
  );
  win.position.set(0, 0.98, 0.151);
  g.add(win);
  return g;
}
