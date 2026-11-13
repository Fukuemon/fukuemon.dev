// 門の内側の立体の庭を組み立てる。配置は layout.ts、色は scene-colors.ts から読む。
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
} from "three";
import {
  CAM0,
  DESIGN,
  FAR_Z,
  GATE,
  GATE_Z,
  MOUNTAINS,
  POND,
  STATIONS,
  STEP_R,
  STEPS,
  WALL,
  ridgeY,
} from "./layout";
import { CLEAR, mixHex, type ScenePalette } from "./scene-colors";
import { rng } from "./brush";
import { canvasTexture, lantern, rock, tree, type TreeLeaf } from "./scene-parts";

type BoxSpec = readonly [number, number, number, number, number, number];

/** 空。上端から地平へ、空の色から霞の色へ移るグラデーションの板 */
function sky(C: ScenePalette): Mesh {
  const stops: readonly (readonly [number, string])[] = [
    [0, C.skyTop],
    [0.7, C.sky],
    [1, C.mist],
  ];
  const map = canvasTexture(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    for (const [at, color] of stops) gr.addColorStop(at, color);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const m = new Mesh(new PlaneGeometry(320, 110), new MeshBasicMaterial({ fog: false, map }));
  m.position.set(0, 30, -100);
  return m;
}

/** 日か月を、外へ薄れる光の輪と一緒に描く */
function drawOrb(g: CanvasRenderingContext2D, o: NonNullable<ScenePalette["orb"]>): void {
  const glow = g.createRadialGradient(o.x, o.y, o.r * 0.9, o.x, o.y, o.r * 4);
  glow.addColorStop(0, o.color);
  glow.addColorStop(1, CLEAR);
  g.globalAlpha = o.glow * 0.5;
  g.fillStyle = glow;
  g.fillRect(o.x - o.r * 4, o.y - o.r * 4, o.r * 8, o.r * 8);
  g.globalAlpha = 1;
  g.fillStyle = o.color;
  g.beginPath();
  g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
  g.fill();
}

/** 山並みを、稜線から裾へ薄れる色で塗る。手前の山並みほど濃い */
function drawMountains(g: CanvasRenderingContext2D, color: string): void {
  MOUNTAINS.forEach((m, i) => {
    const fade = g.createLinearGradient(0, m.base - 200, 0, m.base + 30);
    fade.addColorStop(0, color);
    fade.addColorStop(1, CLEAR);
    g.globalAlpha = i ? 0.4 : 0.62;
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(m.x0, m.base + 30);
    for (let x = m.x0; x <= m.x1; x += 8) g.lineTo(x, ridgeY(m, x));
    g.lineTo(m.x1, m.base + 30);
    g.fill();
  });
}

/** 遠景の板。墨の絵の山並みと同じ式で描き、最初のカメラから同じ位置に見える大きさにする */
function farRange(C: ScenePalette): Mesh {
  const farD = CAM0.pos[2] - FAR_Z;
  const unit = (farD * Math.tan((DESIGN.fov * Math.PI) / 360)) / (DESIGN.h / 2);
  const map = canvasTexture(2048, 1152, (g, w) => {
    g.scale(w / DESIGN.w, w / DESIGN.w);
    if (C.orb) drawOrb(g, C.orb);
    drawMountains(g, C.far);
  });
  const mat = new MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false, map });
  const m = new Mesh(new PlaneGeometry(DESIGN.w * unit, DESIGN.h * unit), mat);
  m.position.set(CAM0.pos[0], CAM0.pos[1], FAR_Z);
  return m;
}

/** 苔の島。[中心 x, z, x の半径, z の半径] */
const MOSS: readonly (readonly [number, number, number, number])[] = [
  [-6.9, -7.4, 2.7, 1.8],
  [2.2, -11.3, 2.6, 1.3],
  [-9.0, -11.2, 1.8, 1.1],
  [5.9, -1.2, 1.6, 1.0],
  [-3.3, -3.2, 1.5, 1.0],
  [6.1, -4.0, 1.3, 0.8],
];

/** 地面の広さ（m）。z は GZ0 から GZ0 + GZ まで */
const GX = 32;
const GZ = 30;
const GZ0 = -17;

/** 地面の m を、テクスチャの px に直す */
interface GroundMap {
  readonly g: CanvasRenderingContext2D;
  readonly px: (x: number) => number;
  readonly pz: (z: number) => number;
  /** 1 m が何 px か */
  readonly sx: number;
  readonly sz: number;
}

/** 白砂に、門の内側の端から奥の塀まで、横に流れる砂紋を引く */
function drawRake({ g, px, pz }: GroundMap, C: ScenePalette): void {
  g.strokeStyle = C.rake;
  g.lineWidth = 2;
  g.globalAlpha = 0.55;
  for (let z = -12.6; z < GATE_Z - 0.4; z += 0.17) {
    g.beginPath();
    for (let x = -15; x <= 15; x += 0.5)
      g.lineTo(px(x), pz(z + Math.sin(x * 0.5 + z * 0.3) * 0.05));
    g.stroke();
  }
}

/** 苔の島を 1 つ描く。島の回りに砂紋を 3 重に巡らせ、苔の上に暗い点を散らす */
function drawMoss(
  { g, px, pz, sx, sz }: GroundMap,
  C: ScenePalette,
  [x, z, rx, rz]: (typeof MOSS)[number],
): void {
  for (let k = 3; k >= 1; k--) {
    g.strokeStyle = C.rake;
    g.fillStyle = C.sand;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(px(x), pz(z), (rx + k * 0.18) * sx, (rz + k * 0.18) * sz, 0, 0, Math.PI * 2);
    g.globalAlpha = 1;
    g.fill();
    g.globalAlpha = 0.6;
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = C.moss;
  g.beginPath();
  g.ellipse(px(x), pz(z), rx * sx, rz * sz, 0, 0, Math.PI * 2);
  g.fill();
  const r = rng(Math.round(x * 31 + z * 7) + 99);
  g.globalAlpha = 0.35;
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    g.fillStyle = r() < 0.5 ? C.mossSpeck : C.moss;
    g.beginPath();
    const cx = px(x + Math.cos(a) * d * rx * 0.95);
    const cz = pz(z + Math.sin(a) * d * rz * 0.95);
    g.ellipse(cx, cz, 4 + r() * 12, 3 + r() * 7, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** 白砂、砂紋、苔、門の外の土を 1 枚のテクスチャに描いた地面 */
function ground(C: ScenePalette, anisotropy: number): Mesh {
  const draw = (g: CanvasRenderingContext2D, W: number, H: number) => {
    const map: GroundMap = {
      g,
      px: (x) => ((x + GX / 2) / GX) * W,
      pz: (z) => ((z - GZ0) / GZ) * H,
      sx: W / GX,
      sz: H / GZ,
    };
    g.fillStyle = C.sand;
    g.fillRect(0, 0, W, H);
    drawRake(map, C);
    for (const island of MOSS) drawMoss(map, C, island);
    g.globalAlpha = 1;
    g.fillStyle = C.earth;
    g.fillRect(0, map.pz(GATE_Z + 0.15), W, H);
  };
  const texture = canvasTexture(2048, 2048, draw, true);
  texture.anisotropy = anisotropy;
  const m = new Mesh(new PlaneGeometry(GX, GZ), new MeshLambertMaterial({ map: texture }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0, GZ0 + GZ / 2);
  m.receiveShadow = true;
  return m;
}

function addGateAndWalls(scene: Scene, C: ScenePalette): void {
  const wood = new MeshLambertMaterial({ color: C.wood });
  const roof = new MeshLambertMaterial({ color: C.roof });
  const plaster = new MeshLambertMaterial({ color: C.plaster });
  const box = ([x, y, z, w, h, d]: BoxSpec, m: MeshLambertMaterial) => {
    const b = new Mesh(new BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    return b;
  };
  for (const b of [...GATE.posts, ...GATE.beams, ...GATE.arms]) box(b, wood);
  const door = GATE.door;
  for (const s of [1, -1]) {
    box([s * door.x, door.h / 2, GATE_Z - 0.08 - door.len / 2, 0.06, door.h, door.len], wood);
  }
  box(GATE.ridge, roof);
  const rf = GATE.roof;
  const slope = Math.hypot(rf.depth, rf.ridgeY - rf.eaveY);
  const tilt = Math.atan2(rf.ridgeY - rf.eaveY, rf.depth);
  for (const s of [1, -1]) {
    const b = box(
      [0, (rf.ridgeY + rf.eaveY) / 2, GATE_Z + (s * rf.depth) / 2, rf.halfW * 2, 0.12, slope],
      roof,
    );
    b.rotation.x = s * tilt;
  }
  const wall = (x: number, z: number, w: number, d: number, roofW: number, roofD: number) => {
    box([x, WALL.h / 2, z, w, WALL.h, d], plaster);
    box([x, WALL.roofY, z, roofW, 0.14, roofD], roof);
  };
  const len = WALL.x1 - WALL.x0;
  for (const s of [1, -1]) {
    wall((s * (WALL.x0 + WALL.x1)) / 2, GATE_Z, len, WALL.t, len + 0.1, 0.75);
  }
  wall(0, -13.2, 32, WALL.t, 32, 0.75);
  for (const s of [1, -1]) wall(s * 14.5, -5.1, WALL.t, 16.2, 0.75, 16.2);
}

/** 石。[x, z, 大きさ x, y, z] */
const ROCKS: readonly (readonly [number, number, number, number, number])[] = [
  [-2.6, 3.65, 0.55, 0.62, 0.42],
  [-3.25, 3.7, 0.24, 0.22, 0.2],
  [-7.0, -6.9, 0.85, 0.95, 0.65],
  [-6.1, -7.5, 0.42, 0.4, 0.4],
  [-7.7, -6.1, 0.5, 0.32, 0.42],
  [5.6, -1.3, 0.55, 0.4, 0.45],
  [2.0, -10.2, 0.4, 0.3, 0.36],
];

function addStones(scene: Scene, C: ScenePalette, R: () => number): void {
  STEPS.concat([
    [-0.1, -1.7],
    [0.1, -3.0],
  ]).forEach(([x, z], i) => {
    const m = rock(R, C.stone, STEP_R, 0.07, STEP_R * 0.82);
    m.position.set(x, 0.02, z);
    m.rotation.y = i;
    scene.add(m);
  });
  for (const [x, z, sx, sy, sz] of ROCKS) {
    const m = rock(R, C.stone, sx, sy, sz);
    m.position.set(x, sy * 0.25, z);
    m.rotation.y = R() * 6;
    scene.add(m);
  }
}

/** 池と、池の縁の石 */
function addPond(scene: Scene, C: ScenePalette, R: () => number): void {
  const sh = new Shape();
  sh.absellipse(0, 0, POND.rx, POND.rz, 0, Math.PI * 2, false, 0);
  const water = new Mesh(new ShapeGeometry(sh, 48), new MeshBasicMaterial({ color: C.water }));
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = POND.rot;
  water.position.set(POND.x, 0.02, POND.z);
  scene.add(water);
  const cos = Math.cos(POND.rot);
  const sin = Math.sin(POND.rot);
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + 0.2;
    const ex = Math.cos(a) * (POND.rx + 0.12);
    const ez = Math.sin(a) * (POND.rz + 0.12);
    const m = rock(R, C.stone, 0.3 + R() * 0.22, 0.16 + R() * 0.12, 0.26 + R() * 0.1);
    m.position.set(POND.x + ex * cos + ez * sin, 0.05, POND.z - ex * sin + ez * cos);
    m.rotation.y = R() * 6;
    scene.add(m);
  }
}

/**
 * 庭の場面を組み立てる。乱数を使う順は試作と同じにしてあり、同じ色からは同じ場面ができる。
 * @param anisotropy 地面のテクスチャの異方性フィルタの値。renderer の上限を渡す
 */
export function buildGarden(C: ScenePalette, anisotropy: number): Scene {
  const scene = new Scene();
  scene.background = new Color(C.sky); // design-system-allow: three の Color のコンストラクタで、色の値ではない
  scene.fog = new Fog(C.mist, 9, 46);
  scene.add(new HemisphereLight(C.hemiSky, C.hemiGround, C.hemiI));
  const sun = new DirectionalLight(C.sun, C.sunI);
  sun.position.set(...C.sunPos);
  sun.target.position.set(0, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 1,
    far: 50,
  });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  scene.add(sky(C), farRange(C), ground(C, anisotropy));
  const plain = new Mesh(new PlaneGeometry(260, 120), new MeshLambertMaterial({ color: C.sand }));
  plain.rotation.x = -Math.PI / 2;
  plain.position.set(0, -0.02, -50);
  scene.add(plain);

  addGateAndWalls(scene, C);
  const R = rng(13);
  addStones(scene, C, R);
  addPond(scene, C, R);

  const lamp = lantern(C.stone, C.lamp, C.lampOn);
  lamp.position.set(-1.5, 0, -11.3);
  lamp.rotation.y = 0.3;
  scene.add(lamp);

  const pineLeaf: TreeLeaf = {
    shape: "fan",
    colors: [C.pine, C.pineLight, mixHex(C.pine, C.pineLight, 0.5)],
  };
  const plant = (x: number, z: number, s: number, dir: 1 | -1, leaf: TreeLeaf | null) => {
    const t = tree(R, C.bark, s, dir, leaf);
    t.position.set(x, 0, z);
    scene.add(t);
  };
  plant(-9.0, -11.2, 1.35, 1, pineLeaf);
  plant(6.4, -1.4, 1.0, -1, pineLeaf);
  for (const { tree: t } of STATIONS) {
    plant(t.at[0], t.at[1], t.s, t.dir, t.leaf === "pine" ? pineLeaf : C.leaf);
  }
  return scene;
}
