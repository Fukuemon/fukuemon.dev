import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color, PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry,
  TubeGeometry, CatmullRomCurve3, MeshBasicMaterial, MeshLambertMaterial, Mesh, Group, CanvasTexture, Vector3, SRGBColorSpace,
  HemisphereLight, DirectionalLight, ShapeGeometry, Shape, PCFSoftShadowMap, LinearFilter, FramebufferTexture, ShaderMaterial, OrthographicCamera, Vector2,
  InstancedMesh, Object3D, DoubleSide, AdditiveBlending,
} from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { DESIGN, CAM0, GATE, GATE_Z, WALL, STEPS, STEP_R, MOUNTAINS, FAR_Z, ridgeY, STATIONS, POND } from "./i-layout.mjs";

const PX = 260;
const T = { ink: 3200, sign: 600, fade: 500, tint0: 300, tint: 1200, move0: 1300, move: 2800, cards: 3700, done: 4500 };

function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw, mip = false) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (!mip) { t.minFilter = LinearFilter; t.generateMipmaps = false; }
  return t;
}
const mixHex = (a, b, k) => "#" + new Color(a).lerp(new Color(b), k).getHexString();

// 場面の色は、時間帯で決める。紙と墨の色は、テーマのセマンティックトークンから取る。
const DAY = {
  skyTop: "#cfd8d6", sky: "#ece8dc", mist: "#ebe7db", far: "#8f9b95", sand: "#e9e3d4", rake: "#cdc4ae", earth: "#ddd4bf",
  moss: "#72805a", mossDark: "#596843", stone: "#8d897f", bark: "#4a3b2e", pine: "#40543a", pineLight: "#586c45",
  wood: "#4d3d2f", woodLight: "#8a7257", plaster: "#eee8da", roof: "#45413d", lamp: "#ecd08f", paper: "#f6f2e7", water: "#8fb4b0",
  text: "#1a1714", textMist: "rgba(251, 249, 243, 0.95)", link: "#3d4b2b",
  hemiSky: "#f6f2e8", hemiGround: "#7b785e", sun: "#fff1d8", sunI: 2.4, hemiI: 1.5, sunPos: [-8, 12, 6], orb: null, lampOn: 0.3,
};
const PAL = {
  day: DAY,
  morning: { ...DAY, skyTop: "#d9dbd6", sky: "#f5e8d4", mist: "#f3eadc", far: "#a09f97", sun: "#ffe0b0", sunI: 2.0, hemiI: 1.45, sunPos: [10, 6, -5], orb: { x: 1170, y: 230, r: 30, color: "#f1cf8e", glow: 0.5 } },
  evening: { ...DAY, skyTop: "#c2bbbd", sky: "#edcfae", mist: "#ead3ba", far: "#9a8c88", sand: "#e6dac6", plaster: "#ecdfca", sun: "#ffb37a", sunI: 2.2, hemiI: 1.25, sunPos: [-11, 4.5, -3], orb: { x: 330, y: 250, r: 40, color: "#d5683f", glow: 0.45 }, lampOn: 0.8 },
  night: {
    skyTop: "#0c121c", sky: "#1f3858", mist: "#22324a", far: "#34475f", sand: "#6a7078", rake: "#565c64", earth: "#5b5f63",
    moss: "#2c3724", mossDark: "#1f2819", stone: "#4f545a", bark: "#1e1813", pine: "#24342a", pineLight: "#31453a",
    wood: "#17110c", woodLight: "#3a2e22", plaster: "#5d5a55", roof: "#101216", lamp: "#ecd08f", paper: "#2b303b", water: "#27405e",
    text: "#f4f1ea", textMist: "rgba(18, 24, 34, 0.92)", link: "#b9cca3",
    hemiSky: "#8ea4c6", hemiGround: "#1a1f17", sun: "#a9bce6", sunI: 1.5, hemiI: 2.3, sunPos: [-6, 12, 5], orb: { x: 640, y: 150, r: 34, color: "#ecd08f", glow: 0.55 }, lampOn: 1,
  },
};
const SEASON = {
  spring: { leaf: ["#e3a5b6", "#f0c4cf", "#f6dbe1"], leafShape: "petal", fall: "#e9a9bb", shape: "petal", n: 70 },
  summer: { leaf: ["#56743d", "#6f8d4e", "#88a262"], leafShape: "momiji", fall: "#e9f58a", shape: "glow", n: 34 },
  autumn: { leaf: ["#a83c26", "#c65a2e", "#d98a3c"], leafShape: "momiji", fall: "#b8482d", shape: "momiji", n: 60 },
  winter: { leaf: null, fall: "#fbfaf6", shape: "flake", n: 110 },
};

function rock(rand, color, sx, sy, sz, smooth) {
  const geo = smooth ? new SphereGeometry(1, 26, 18) : new SphereGeometry(1, 9, 7);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = smooth ? 0.97 + rand() * 0.05 : 0.86 + rand() * 0.24;
    p.setXYZ(i, p.getX(i) * k, Math.max(p.getY(i), -0.35) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ color, flatShading: !smooth }));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
// 木。葉は、葉の形の小さな板を枝の先に集めて描く。松は、針の扇の形の板を使う。leaf は { shape, colors } で、無ければ枝だけにする。
function tree(rand, C, s, dir, leaf) {
  const g = new Group();
  const bark = new MeshLambertMaterial({ color: C.bark });
  const trunk = new CatmullRomCurve3([
    new Vector3(0, -0.1, 0), new Vector3(0.12 * dir, 0.7, 0), new Vector3(-0.15 * dir, 1.5, 0.1), new Vector3(0.35 * dir, 2.3, 0), new Vector3(0.9 * dir, 2.9, -0.1),
  ]);
  const t = new Mesh(new TubeGeometry(trunk, 32, 0.11, 7), bark);
  t.castShadow = true;
  g.add(t);
  const pads = [[0.55, 1.2 * dir, 0.25, 0.9], [0.68, -0.9 * dir, 0.1, 0.75], [0.8, 1.6 * dir, -0.2, 1.0], [0.92, 0.2 * dir, 0.35, 0.7], [1, 1.25 * dir, 0.05, 0.8]];
  const spots = [];
  const pine = leaf && leaf.shape === "fan";
  for (const [u, ox, oz, size] of pads) {
    const a = trunk.getPoint(u);
    const end = new Vector3(a.x + ox, a.y + 0.15, a.z + oz);
    const mid = new Vector3((a.x + end.x) / 2, a.y + 0.25, (a.z + end.z) / 2);
    const br = new Mesh(new TubeGeometry(new CatmullRomCurve3([a, mid, end]), 10, 0.035, 5), bark);
    br.castShadow = true;
    g.add(br);
    for (let k = 0; k < 3; k++) {
      const tip = new Vector3(end.x + (rand() - 0.5) * size * 0.9, end.y + 0.1 + rand() * size * (pine ? 0.1 : 0.4), end.z + (rand() - 0.5) * size * 0.7);
      g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([mid.clone().lerp(end, 0.4 + rand() * 0.5), tip]), 4, 0.016, 4), bark));
    }
    const n = pine ? 34 : 110;
    for (let i = 0; i < n; i++) {
      const an = rand() * Math.PI * 2, rr = Math.sqrt(rand());
      spots.push([
        end.x + Math.cos(an) * rr * size * (pine ? 0.95 : 0.8), end.y + (pine ? 0.02 + rand() * 0.16 : (rand() - 0.25) * size * 0.75), end.z + Math.sin(an) * rr * size * (pine ? 0.6 : 0.65),
        (pine ? 0.42 : 0.2) * (0.75 + rand() * 0.5),
      ]);
    }
  }
  if (leaf) {
    const m = new InstancedMesh(new PlaneGeometry(1, 1), new MeshLambertMaterial({ map: shapeTex(leaf.shape), alphaTest: 0.4, side: DoubleSide }), spots.length);
    const d = new Object3D(), col = new Color();
    spots.forEach(([x, y, z, k], i) => {
      d.position.set(x, y, z);
      if (pine) d.rotation.set((rand() - 0.5) * 0.7, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
      else d.rotation.set(rand() * 6.3, rand() * 6.3, rand() * 6.3);
      d.scale.setScalar(k);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, col.set(leaf.colors[Math.floor(rand() * leaf.colors.length)]));
    });
    m.frustumCulled = false;
    g.add(m);
  }
  g.scale.setScalar(s);
  g.userData.top = trunk.getPoint(0.86).multiplyScalar(s);
  return g;
}
function lantern(C) {
  const g = new Group();
  const st = new MeshLambertMaterial({ color: C.stone, flatShading: true });
  const parts = [
    [new CylinderGeometry(0.26, 0.3, 0.12, 6), 0.06], [new CylinderGeometry(0.08, 0.1, 0.62, 8), 0.43], [new CylinderGeometry(0.28, 0.2, 0.1, 6), 0.79],
    [new BoxGeometry(0.3, 0.28, 0.3), 0.98], [new ConeGeometry(0.46, 0.26, 6), 1.25], [new SphereGeometry(0.06, 8, 6), 1.42],
  ];
  for (const [geo, y] of parts) { const m = new Mesh(geo, st); m.position.y = y; m.castShadow = true; g.add(m); }
  const win = new Mesh(new PlaneGeometry(0.15, 0.16), new MeshBasicMaterial({ color: C.lamp, transparent: true, opacity: C.lampOn }));
  win.position.set(0, 0.98, 0.151);
  g.add(win);
  return g;
}
function shapeTex(shape) {
  return canvasTex(64, 64, (g, w) => {
    g.translate(w / 2, w / 2);
    g.fillStyle = "#fff";
    if (shape === "glow") {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
    } else if (shape === "flake") {
      g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill();
    } else if (shape === "fan") {
      g.strokeStyle = "#fff"; g.lineWidth = 2.2; g.lineCap = "round";
      for (let k = 0; k < 15; k++) {
        const an = -Math.PI * (0.08 + 0.84 * (k / 14));
        g.beginPath(); g.moveTo(0, 26); g.lineTo(Math.cos(an) * 30, 26 + Math.sin(an) * 54); g.stroke();
      }
    } else if (shape === "petal") {
      g.beginPath(); g.moveTo(0, 28); g.bezierCurveTo(-22, 10, -18, -18, -5, -28); g.lineTo(0, -20); g.lineTo(5, -28); g.bezierCurveTo(18, -18, 22, 10, 0, 28); g.fill();
    } else {
      const len = [13, 21, 26, 30, 26, 21, 13];
      g.beginPath(); g.moveTo(0, 8);
      for (let k = 0; k < 7; k++) {
        const an = ((-90 + (k - 3) * 37) * Math.PI) / 180;
        for (const [da, r] of [[-0.2, 0.42], [0, 1], [0.2, 0.42]]) g.lineTo(Math.cos(an + da) * len[k] * r, Math.sin(an + da) * len[k] * r);
      }
      g.fill();
    }
  });
}

export async function start(stage, opts) {
  const canvas = stage.querySelector("canvas.gl");
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  } catch (e) {
    return null;
  }
  const portrait = () => stage.clientWidth < stage.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, portrait() ? 1.25 : 1.5));
  renderer.shadowMap.enabled = !portrait();
  renderer.shadowMap.type = PCFSoftShadowMap;

  const C = PAL[opts.time] || PAL.day;
  const S = SEASON[opts.season] || SEASON.autumn;
  const snow = opts.season === "winter";
  const sand = snow ? mixHex(C.sand, "#ffffff", 0.55) : C.sand;
  const moss = snow ? mixHex(C.moss, "#ffffff", 0.6) : C.moss;
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue("--fd-color-surface").trim(), ink = cs.getPropertyValue("--fd-color-text").trim();

  const scene = new Scene();
  scene.background = new Color(C.sky);
  scene.fog = new Fog(new Color(C.mist), 9, 46);
  scene.add(new HemisphereLight(new Color(C.hemiSky), new Color(C.hemiGround), C.hemiI));
  const sun = new DirectionalLight(new Color(C.sun), C.sunI);
  sun.position.set(...C.sunPos);
  sun.target.position.set(0, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const sky = new Mesh(new PlaneGeometry(320, 110), new MeshBasicMaterial({ fog: false, map: canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, C.skyTop); gr.addColorStop(0.7, C.sky); gr.addColorStop(1, C.mist);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }) }));
  sky.position.set(0, 30, -100);
  scene.add(sky);

  // 遠景の板。墨の絵の山並みと同じ式で描き、最初のカメラから同じ位置に見える大きさにする。
  const farD = CAM0.pos[2] - FAR_Z, unit = (farD * Math.tan((DESIGN.fov * Math.PI) / 360)) / (DESIGN.h / 2);
  const far = new Mesh(new PlaneGeometry(DESIGN.w * unit, DESIGN.h * unit), new MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false, map: canvasTex(2048, 1152, (g, w) => {
    g.scale(w / DESIGN.w, w / DESIGN.w);
    if (C.orb) {
      const o = C.orb, gr = g.createRadialGradient(o.x, o.y, o.r * 0.9, o.x, o.y, o.r * 4);
      gr.addColorStop(0, o.color); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = o.glow * 0.5; g.fillStyle = gr; g.fillRect(o.x - o.r * 4, o.y - o.r * 4, o.r * 8, o.r * 8);
      g.globalAlpha = 1; g.fillStyle = o.color; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
    }
    MOUNTAINS.forEach((m, i) => {
      const gr = g.createLinearGradient(0, m.base - 200, 0, m.base + 30);
      gr.addColorStop(0, C.far); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = i ? 0.4 : 0.62; g.fillStyle = gr;
      g.beginPath(); g.moveTo(m.x0, m.base + 30);
      for (let x = m.x0; x <= m.x1; x += 8) g.lineTo(x, ridgeY(m, x));
      g.lineTo(m.x1, m.base + 30); g.fill();
    });
  }) }));
  far.position.set(CAM0.pos[0], CAM0.pos[1], FAR_Z);
  scene.add(far);

  const R = rng(13);
  const mossAt = [[-6.9, -7.4, 2.7, 1.8], [2.2, -11.3, 2.6, 1.3], [-9.0, -11.2, 1.8, 1.1], [5.9, -1.2, 1.6, 1.0], [-3.3, -3.2, 1.5, 1.0], [6.1, -4.0, 1.3, 0.8]];
  const GX = 32, GZ = 30, GZ0 = -17;
  const ground = new Mesh(new PlaneGeometry(GX, GZ), new MeshLambertMaterial({ map: canvasTex(2048, 2048, (g, W, H) => {
    const px = (x) => ((x + GX / 2) / GX) * W, pz = (z) => ((z - GZ0) / GZ) * H;
    g.fillStyle = sand; g.fillRect(0, 0, W, H);
    g.strokeStyle = C.rake; g.lineWidth = 2; g.globalAlpha = 0.55;
    for (let z = -12.6; z < GATE_Z - 0.4; z += 0.17) {
      g.beginPath();
      for (let x = -15; x <= 15; x += 0.5) g.lineTo(px(x), pz(z + Math.sin(x * 0.5 + z * 0.3) * 0.05));
      g.stroke();
    }
    for (const [x, z, rx, rz] of mossAt) {
      for (let k = 3; k >= 1; k--) {
        g.globalAlpha = 0.6; g.strokeStyle = C.rake; g.fillStyle = sand; g.lineWidth = 2;
        g.beginPath(); g.ellipse(px(x), pz(z), (rx + k * 0.18) * (W / GX), (rz + k * 0.18) * (H / GZ), 0, 0, 7); g.globalAlpha = 1; g.fill(); g.globalAlpha = 0.6; g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = moss;
      g.beginPath(); g.ellipse(px(x), pz(z), rx * (W / GX), rz * (H / GZ), 0, 0, 7); g.fill();
      const r = rng(Math.round(x * 31 + z * 7) + 99);
      for (let i = 0; i < 260; i++) {
        const a = r() * 7, d = Math.sqrt(r());
        g.fillStyle = r() < 0.5 ? (snow ? "#ffffff" : C.mossDark) : moss; g.globalAlpha = 0.35;
        g.beginPath(); g.ellipse(px(x + Math.cos(a) * d * rx * 0.95), pz(z + Math.sin(a) * d * rz * 0.95), 4 + r() * 12, 3 + r() * 7, 0, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1; g.fillStyle = C.earth; g.fillRect(0, pz(GATE_Z + 0.15), W, H);
  }, true) }));
  ground.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, GZ0 + GZ / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const plain = new Mesh(new PlaneGeometry(260, 120), new MeshLambertMaterial({ color: sand }));
  plain.rotation.x = -Math.PI / 2;
  plain.position.set(0, -0.02, -50);
  scene.add(plain);

  const mat = (c) => new MeshLambertMaterial({ color: c });
  const wood = mat(C.wood), roofMat = mat(C.roof), plaster = mat(C.plaster);
  const box = ([x, y, z, w, h, d], m, shadow = true) => {
    const b = new Mesh(new BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = shadow; b.receiveShadow = true;
    scene.add(b);
    return b;
  };
  GATE.posts.forEach((b) => box(b, wood));
  GATE.beams.forEach((b) => box(b, wood));
  GATE.arms.forEach((b) => box(b, wood));
  [1, -1].forEach((s) => box([s * GATE.door.x, GATE.door.h / 2, GATE_Z - 0.08 - GATE.door.len / 2, 0.06, GATE.door.h, GATE.door.len], wood));
  box(GATE.ridge, roofMat);
  const rf = GATE.roof, slope = Math.hypot(rf.depth, rf.ridgeY - rf.eaveY), tilt = Math.atan2(rf.ridgeY - rf.eaveY, rf.depth);
  [1, -1].forEach((s) => {
    const b = box([0, (rf.ridgeY + rf.eaveY) / 2, GATE_Z + (s * rf.depth) / 2, rf.halfW * 2, 0.12, slope], roofMat);
    b.rotation.x = s * tilt;
  });
  [1, -1].forEach((s) => {
    const cx = (s * (WALL.x0 + WALL.x1)) / 2, len = WALL.x1 - WALL.x0;
    box([cx, WALL.h / 2, GATE_Z, len, WALL.h, WALL.t], plaster);
    box([cx, WALL.roofY, GATE_Z, len + 0.1, 0.14, 0.75], roofMat);
  });
  box([0, WALL.h / 2, -13.2, 32, WALL.h, WALL.t], plaster);
  box([0, WALL.roofY, -13.2, 32, 0.14, 0.75], roofMat);
  [1, -1].forEach((s) => {
    box([s * 14.5, WALL.h / 2, -5.1, WALL.t, WALL.h, 16.2], plaster);
    box([s * 14.5, WALL.roofY, -5.1, 0.75, 0.14, 16.2], roofMat);
  });

  STEPS.concat([[-0.1, -1.7], [0.1, -3.0]]).forEach(([x, z], i) => {
    const m = rock(R, C.stone, STEP_R, 0.07, STEP_R * 0.82);
    m.position.set(x, 0.02, z);
    m.rotation.y = i;
    scene.add(m);
  });
  [[-2.6, 3.65, 0.55, 0.62, 0.42], [-3.25, 3.7, 0.24, 0.22, 0.2], [-7.0, -6.9, 0.85, 0.95, 0.65], [-6.1, -7.5, 0.42, 0.4, 0.4], [-7.7, -6.1, 0.5, 0.32, 0.42], [5.6, -1.3, 0.55, 0.4, 0.45], [2.0, -10.2, 0.4, 0.3, 0.36]].forEach(([x, z, sx, sy, sz]) => {
    const m = rock(R, C.stone, sx, sy, sz);
    m.position.set(x, sy * 0.25, z);
    m.rotation.y = R() * 6;
    scene.add(m);
  });
  {
    const sh = new Shape();
    sh.absellipse(0, 0, POND.rx, POND.rz, 0, Math.PI * 2, false, 0);
    const pond = new Mesh(new ShapeGeometry(sh, 48), new MeshBasicMaterial({ color: C.water }));
    pond.rotation.x = -Math.PI / 2;
    pond.rotation.z = POND.rot;
    pond.position.set(POND.x, 0.02, POND.z);
    scene.add(pond);
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * Math.PI * 2 + 0.2, ex = Math.cos(a) * (POND.rx + 0.12), ez = Math.sin(a) * (POND.rz + 0.12);
      const m = rock(R, C.stone, 0.3 + R() * 0.22, 0.16 + R() * 0.12, 0.26 + R() * 0.1);
      m.position.set(POND.x + ex * Math.cos(POND.rot) + ez * Math.sin(POND.rot), 0.05, POND.z - ex * Math.sin(POND.rot) + ez * Math.cos(POND.rot));
      m.rotation.y = R() * 6;
      scene.add(m);
    }
  }
  const lamp = lantern(C);
  lamp.position.set(-1.5, 0, -11.3);
  lamp.rotation.y = 0.3;
  scene.add(lamp);
  const night = opts.time === "night";
  const pineLeaf = { shape: "fan", colors: [C.pine, C.pineLight, mixHex(C.pine, C.pineLight, 0.5)] };
  const seasonLeaf = S.leaf ? { shape: S.leafShape, colors: S.leaf.map((c) => (night ? mixHex(c, "#10151c", 0.3) : c)) } : null;
  const p1 = tree(R, C, 1.35, 1, pineLeaf); p1.position.set(-9.0, 0, -11.2); scene.add(p1);
  const p2 = tree(R, C, 1.0, -1, pineLeaf); p2.position.set(6.4, 0, -1.4); scene.add(p2);
  const stTrees = STATIONS.map((st) => {
    if (!st.tree) return null;
    const t = tree(R, C, st.tree.s, st.tree.dir, st.tree.leaf === "pine" ? pineLeaf : seasonLeaf);
    t.position.set(st.tree.at[0], 0, st.tree.at[1]);
    scene.add(t);
    return t;
  });

  // 舞う物。動き続けるので、止めるボタンを持つ。
  const N = S.n, glow = S.shape === "glow";
  const fallOn = !glow || opts.time === "evening" || opts.time === "night";
  const fall = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
    color: S.fall, map: shapeTex(S.shape), transparent: true, alphaTest: glow ? 0 : 0.5, side: DoubleSide, depthWrite: false, fog: !glow,
    blending: glow && opts.time === "night" ? AdditiveBlending : 1,
  }), N);
  fall.visible = fallOn;
  fall.frustumCulled = false;
  scene.add(fall);
  const FR = rng(5), seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ x: -8 + FR() * 16, z: -12 + FR() * 16, p: FR(), v: 0.6 + FR() * 0.6, s: 0.6 + FR() * 0.7, a: FR() * 7 });
  const dummy = new Object3D();
  function placeFall(sec) {
    for (let i = 0; i < N; i++) {
      const q = seeds[i];
      if (glow) {
        dummy.position.set(q.x * 0.8 + Math.sin(sec * 0.3 * q.v + q.a) * 0.6, 0.5 + q.p * 1.4 + Math.sin(sec * 0.5 + q.a * 2) * 0.2, q.z * 0.8 - 2 + Math.cos(sec * 0.25 + q.a) * 0.6);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar(0.42 * q.s * (0.35 + 0.65 * Math.max(0, Math.sin(sec * 1.3 * q.v + q.a))));
      } else {
        const speed = snow ? 0.42 : 0.55, H = 5.2, y = H - ((sec * speed * q.v + q.p * H) % H);
        dummy.position.set(q.x + Math.sin(sec * 0.9 * q.v + q.a) * (snow ? 0.15 : 0.45), y, q.z + Math.cos(sec * 0.7 + q.a) * 0.25);
        if (snow) dummy.quaternion.copy(camera.quaternion); else dummy.rotation.set(sec * 1.7 * q.v + q.a, sec * 1.1 + q.a, q.a);
        dummy.scale.setScalar((snow ? 0.045 : 0.13) * q.s);
      }
      dummy.updateMatrix();
      fall.setMatrixAt(i, dummy.matrix);
    }
    fall.instanceMatrix.needsUpdate = true;
  }

  const camera = new PerspectiveCamera(DESIGN.fov, 1, 0.05, 400);
  const tanD = Math.tan((DESIGN.fov * Math.PI) / 360);
  // 墨の絵の SVG と同じ切り取り方にする。横長は幅、正方形に近い画面は高さ、縦長は幅の 1.25 倍に、絵の幅を合わせる。
  function fov0() {
    const w = stage.clientWidth, h = stage.clientHeight, a = w / h;
    const svgW = a >= 16 / 9 ? w : a >= 1 ? (h * 16) / 9 : w * 1.25;
    return (Math.atan((tanD * h) / ((svgW * 9) / 16)) * 360) / Math.PI;
  }
  const fovG = () => (portrait() ? 62 : DESIGN.fov);

  // 文は DOM のまま CSS3DRenderer で、木の枝に掛けた和紙に置く。WebGL と深度を共有しないので、文は門を抜けた後に現す。
  const cssR = new CSS3DRenderer();
  cssR.domElement.classList.add("cards3d");
  stage.appendChild(cssR.domElement);
  const cssScene = new Scene();
  const cards = [...document.querySelectorAll("main .fuda")];
  const home = cards.map((el) => el.parentNode);
  const stations = [];
  stage.style.setProperty("--scene-text", C.text);
  stage.style.setProperty("--scene-mist", C.textMist);
  stage.style.setProperty("--scene-link", C.link);
  const paperMat = new MeshBasicMaterial({ color: C.paper });
  function mount() {
    cards.forEach((el, i) => {
      const st = STATIONS[i], o = new CSS3DObject(el), flat = st.kind === "water";
      el.classList.add("on-" + st.kind);
      el.style.userSelect = "text";
      o.position.set(...st.pos);
      o.rotation.order = "YXZ";
      o.rotation.y = st.rot;
      if (flat) o.rotation.x = -Math.PI / 2;
      o.scale.setScalar(1 / PX);
      cssScene.add(o);
      const e = flat ? st.el : 0, w = el.offsetWidth / PX, h = el.offsetHeight / PX;
      const s = { w, h, squash: flat ? Math.sin(st.el) : 1, n: new Vector3(Math.sin(st.rot) * Math.cos(e), Math.sin(e), Math.cos(st.rot) * Math.cos(e)), c: new Vector3(...st.pos) };
      if (st.kind === "scroll") {
        // 和紙を、上下の軸木と 2 本の紐で、木から伸びる枝に掛ける。
        const pw = w + 0.36, ph = h + 0.4, g = new Group();
        const paper = new Mesh(new PlaneGeometry(pw, ph), paperMat);
        paper.position.z = -0.015;
        g.add(paper);
        [1, -1].forEach((k) => {
          const rod = new Mesh(new CylinderGeometry(0.028, 0.028, pw + 0.14, 8), wood);
          rod.rotation.z = Math.PI / 2;
          rod.position.set(0, (k * ph) / 2, -0.015);
          rod.castShadow = true;
          g.add(rod);
          const cord = new Mesh(new BoxGeometry(0.012, 0.42, 0.012), wood);
          cord.position.set(k * (pw / 2 - 0.1), ph / 2 + 0.21, -0.015);
          g.add(cord);
        });
        g.position.set(...st.pos);
        g.rotation.y = st.rot;
        scene.add(g);
        const right = new Vector3(Math.cos(st.rot), 0, -Math.sin(st.rot)), y = st.pos[1] + ph / 2 + 0.42;
        const ends = [-1, 1].map((k) => s.c.clone().addScaledVector(right, k * (pw / 2 + 0.25)).setY(y));
        const from = stTrees[i].position.clone().add(stTrees[i].userData.top);
        if (from.distanceTo(ends[0]) > from.distanceTo(ends[1])) ends.reverse();
        const bough = new Mesh(new TubeGeometry(new CatmullRomCurve3([from, from.clone().lerp(ends[0], 0.55).add(new Vector3(0, 0.22, 0)), ends[0], ends[1].clone().add(new Vector3(0, 0.05, 0))]), 24, 0.032, 6), new MeshLambertMaterial({ color: C.bark }));
        bough.castShadow = true;
        scene.add(bough);
        s.w = pw; s.h = ph;
      }
      stations.push(s);
    });
  }
  function unmount() {
    cards.forEach((el, i) => { el.removeAttribute("style"); el.classList.remove("on-" + STATIONS[i].kind); home[i].appendChild(el); });
  }
  function pose(i) {
    const s = stations[i], a = stage.clientWidth / stage.clientHeight, t2 = 2 * Math.tan((fovG() * Math.PI) / 360);
    const d = Math.max(2.1, s.w / (portrait() ? 0.92 : s.squash < 1 ? 0.4 : 0.46) / (t2 * a), (s.h * s.squash) / (s.squash < 1 ? 0.42 : 0.56) / t2) * (s.squash < 1 ? 1.25 : 1);
    return { pos: s.c.clone().addScaledVector(s.n, d).add(new Vector3(0, s.squash < 1 ? 0 : 0.05, 0)), look: s.c.clone() };
  }

  const srgb = (c) => new Color(c).convertLinearToSRGB();
  const skyC = srgb(C.sky);
  const U = {
    tScene: { value: null }, uPx: { value: new Vector2() }, uAspect: { value: 1 }, uTint: { value: 0 }, uVig: { value: 0.8 },
    uPaper: { value: srgb(paper) }, uInkCol: { value: srgb(ink) }, uLine: { value: srgb(new Color(ink).getHSL({}).l < 0.5 ? ink : paper) }, uEdge: { value: srgb(opts.time === "night" ? C.mist : paper) }, uSky: { value: skyC.r * 0.2126 + skyC.g * 0.7152 + skyC.b * 0.0722 },
  };
  // 場面を描いた絵に全画面のパスを 1 枚かけ、墨の輪郭線、淡彩、紙の質感、端の余白を重ねる。uTint が 0 のときは墨だけの絵になる。
  const post = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tScene; uniform vec2 uPx; uniform float uAspect, uTint, uSky, uVig; uniform vec3 uPaper, uInkCol, uLine, uEdge;
      varying vec2 vUv;
      float L(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return n(p) * 0.5 + n(p * 2.03) * 0.3 + n(p * 4.1) * 0.2; }
      float S(vec2 o) { return L(texture2D(tScene, vUv + o * uPx).rgb); }
      void main() {
        vec2 q = vec2(vUv.x * uAspect, vUv.y);
        vec2 wob = (vec2(fbm(q * 9.0), fbm(q * 9.0 + 5.0)) - 0.5) * uPx * 5.0;
        vec3 c = texture2D(tScene, vUv + wob).rgb;
        float e = length(vec2(S(vec2(1.6, 0)) - S(vec2(-1.6, 0)), S(vec2(0, 1.6)) - S(vec2(0, -1.6))));
        float dry = 0.55 + 0.45 * n(q * vec2(50.0, 300.0));
        float line = smoothstep(0.05, 0.17, e) * dry;
        float wash = smoothstep(0.04, 0.7, abs(L(c) - uSky) / max(uSky, 1.0 - uSky));
        wash = mix(wash, floor(wash * 3.0 + 0.5) / 3.0, 0.6);
        vec3 inkImg = mix(uPaper, uInkCol, clamp(max(line * 0.8, wash * 0.8 * (0.8 + 0.2 * fbm(q * 30.0))), 0.0, 1.0));
        float pool = fbm(q * 5.0 + 3.0);
        vec3 col = mix(mix(c, vec3(L(c)), 0.22), uPaper, 0.16 + 0.18 * pool);
        col = mix(col, uLine, line * 0.62);
        col *= 1.0 - 0.07 * (fbm(q * 120.0) - 0.5);
        float edge = smoothstep(0.5, 1.0, length((vUv - vec2(0.5, 0.52)) * vec2(1.2, 1.55)) + (fbm(q * 2.6) - 0.5) * 0.4);
        col = mix(col, uEdge, edge * uVig);
        float o2 = fbm(q * 3.0 + 7.0) * 0.7 + 0.3 * distance(vUv, vec2(0.5, 0.5));
        gl_FragColor = vec4(mix(inkImg, col, smoothstep(o2, o2 + 0.3, uTint * 2.2)), 1.0);
      }`,
  }));
  post.frustumCulled = false;
  const postScene = new Scene();
  postScene.add(post);
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const state = { phase: opts.intro ? "wait" : "garden", t0: 0, station: 0, px: 0, py: 0, paused: false, sec: 0, last: 0 };
  const cur = { pos: new Vector3(...CAM0.pos), look: new Vector3(...CAM0.look) };
  const perf = { n: 0, ms: 0, last: 0, worst: 0 };
  let raf = 0;

  let stopped = false;
  function frame(now) {
    raf = 0;
    if (stopped) return;
    if (perf.last && now - perf.last < 250) { perf.n++; perf.ms += now - perf.last; perf.worst = Math.max(perf.worst, now - perf.last); }
    perf.last = now;
    const dt = state.last ? Math.min(100, now - state.last) : 16;
    state.last = now;
    if (!state.paused) state.sec += dt / 1000;
    let moving = false;
    if (state.phase === "wait") {
      camera.fov = fov0();
      U.uTint.value = 0;
    } else if (state.phase === "enter") {
      const t = now - state.t0, m = ease(clamp01((t - T.move0) / T.move)), end = pose(0);
      U.uTint.value = clamp01((t - T.tint0) / T.tint);
      cur.pos.set(...CAM0.pos).lerp(end.pos, m);
      cur.look.set(...CAM0.look).lerp(end.look, m);
      camera.fov = fov0() + (fovG() - fov0()) * m;
      if (t >= T.cards) opts.on("cards");
      if (t >= T.done) { state.phase = "garden"; opts.on("done"); }
      moving = true;
    } else {
      U.uTint.value = 1;
      const tgt = pose(state.station), k = 1 - Math.exp(-dt / 260);
      tgt.pos.x += state.px * 0.25; tgt.pos.y -= state.py * 0.08;
      cur.pos.lerp(tgt.pos, k); cur.look.lerp(tgt.look, k);
      camera.fov += (fovG() - camera.fov) * k;
      moving = cur.pos.distanceTo(tgt.pos) + cur.look.distanceTo(tgt.look) > 0.003;
    }
    camera.position.copy(cur.pos);
    camera.lookAt(cur.look);
    camera.updateProjectionMatrix();
    if (fallOn) placeFall(state.sec);
    renderer.render(scene, camera);
    renderer.copyFramebufferToTexture(U.tScene.value);
    renderer.render(postScene, postCam);
    if (state.phase !== "wait") cssR.render(cssScene, camera);
    if (moving || (fallOn && !state.paused)) kick();
  }
  function kick() { if (!raf && !stopped) raf = requestAnimationFrame(frame); }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    cssR.setSize(w, h);
    const sz = renderer.getDrawingBufferSize(new Vector2());
    if (U.tScene.value) U.tScene.value.dispose();
    U.tScene.value = new FramebufferTexture(sz.x, sz.y);
    U.uPx.value.set(renderer.getPixelRatio() / sz.x, renderer.getPixelRatio() / sz.y);
    U.uAspect.value = w / h;
    camera.aspect = w / h;
    kick();
  }
  mount();
  if (!opts.intro) { const p = pose(0); cur.pos.copy(p.pos); cur.look.copy(p.look); camera.fov = fovG(); }
  addEventListener("resize", resize);
  resize();

  return {
    enter() { state.phase = "enter"; state.t0 = performance.now(); kick(); },
    skip() { state.phase = "garden"; const p = pose(state.station); cur.pos.copy(p.pos); cur.look.copy(p.look); camera.fov = fovG(); kick(); },
    go(i) { state.station = (i + stations.length) % stations.length; kick(); return state.station; },
    station() { return state.station; },
    pointer(x, y) { state.px = x; state.py = y; kick(); },
    pause(on) { state.paused = on; state.last = 0; kick(); },
    stop() { stopped = true; cancelAnimationFrame(raf); unmount(); cssR.domElement.remove(); },
    stats() {
      const g = renderer.getContext(), ext = g.getExtension("WEBGL_debug_renderer_info");
      return {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled,
        fps: perf.ms ? Math.round((perf.n / perf.ms) * 1000) : 0, frames: perf.n, worstMs: Math.round(perf.worst), gpu: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "",
      };
    },
    resetPerf() { perf.n = 0; perf.ms = 0; perf.worst = 0; },
  };
}

// ページの側の流れ。墨の絵（SVG と CSS）が描き終わり、場面の準備もできてから、色を差して門をくぐる。
(async function () {
  const h = document.documentElement, stage = document.querySelector(".stage");
  if (!h.classList.contains("stage-on")) return;
  const intro = h.classList.contains("intro"), born = window.__born || performance.now();
  const mark = (window.__marks = {});
  const nav = document.querySelector(".garden-nav"), tabs = [...nav.querySelectorAll("[data-station]")];
  const leave = () => { h.classList.remove("stage-on", "intro", "enter", "garden", "cards-on"); };
  let api = null, done = false;
  const finish = () => { if (done) return; done = true; h.classList.remove("intro", "enter"); h.classList.add("garden", "cards-on"); mark.done = Math.round(performance.now() - born); };
  api = await start(stage, {
    intro, season: h.dataset.season, time: h.dataset.time,
    on(ev) { if (ev === "cards") h.classList.add("cards-on"); if (ev === "done") finish(); },
  });
  if (!api) { leave(); return; }
  mark.ready = Math.round(performance.now() - born);
  const fuda = [...document.querySelectorAll(".fuda")];
  const select = (i) => { const s = api.go(i); tabs.forEach((b, k) => b.setAttribute("aria-current", k === s ? "true" : "false")); fuda.forEach((el, k) => el.classList.toggle("is-current", k === s)); };
  tabs.forEach((b, i) => b.addEventListener("click", () => select(i)));
  document.querySelectorAll(".fuda").forEach((el, i) => el.addEventListener("focusin", () => { if (done) select(i); }));
  addEventListener("keydown", (e) => {
    if (!done || e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") select(api.station() + 1);
    if (e.key === "ArrowLeft") select(api.station() - 1);
  });
  const pauseBtn = nav.querySelector(".pause");
  pauseBtn.addEventListener("click", () => { const on = pauseBtn.getAttribute("aria-pressed") !== "true"; pauseBtn.setAttribute("aria-pressed", String(on)); api.pause(on); });
  nav.querySelector(".plain").addEventListener("click", () => { api.stop(); leave(); fuda.forEach((el) => el.classList.remove("is-current")); document.querySelector("main h1").focus(); });
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  addEventListener("pointermove", (e) => { if (fine.matches && done) api.pointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1); });
  window.__garden = api;
  select(0);
  if (!intro) { h.classList.add("gl-on"); finish(); return; }
  const skip = document.querySelector(".skip-intro");
  const jump = () => { if (done) return; h.classList.add("gl-on", "no-anim"); api.skip(); finish(); tabs[0].focus(); };
  skip.addEventListener("click", jump);
  addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key === "Tab") jump(); });
  setTimeout(() => {
    if (done) return;
    mark.enter = Math.round(performance.now() - born);
    h.classList.add("gl-on", "enter");
    api.enter();
  }, Math.max(0, T.ink + (h.classList.contains("sign-on") ? T.sign : 0) - (performance.now() - born)));
})();
