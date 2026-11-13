// 庭を canvas に描く。場面を描き、全画面のパスで画風を付ける。
// 舞う物が無い間は場面が動かないので、開いたときと画面の大きさが変わったときだけ描く。
import {
  FramebufferTexture,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { createInkPass } from "./ink-pass";
import { PAPER_PAD, PX, STATIONS } from "./layout";
import { scenePalette } from "./scene-colors";
import { buildGarden } from "./scene";
import type { SeasonTime } from "./season";

// 和紙の文の大きさ（px）の仮の値。文を和紙に置くときに、文の要素の大きさを測った値に替える。
// 幅は Design Doc の「和紙の文」の 25rem と 17.5rem で、高さは試作の名乗りの文を測った値である。
const TEXT = { wide: { w: 400, h: 240 }, narrow: { w: 280, h: 360 } } as const;

const webglAvailable = () => document.createElement("canvas").getContext("webgl2") !== null;

/**
 * 庭を `stage` の中の canvas に描き始める。
 * @returns 描き始めたら true。canvas が無いときと WebGL を使えないときは、何も描かずに false を返す
 * @throws 場面を組み立てる途中の例外は、そのまま投げる
 */
export function startGarden(stage: HTMLElement, opts: SeasonTime): boolean {
  const canvas = stage.querySelector("canvas");
  if (!canvas || !webglAvailable()) return false;
  const portrait = () => stage.clientWidth < stage.clientHeight;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  } catch {
    return false;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, portrait() ? 1.25 : 1.5));
  renderer.shadowMap.enabled = !portrait();
  renderer.shadowMap.type = PCFSoftShadowMap;

  const C = scenePalette(opts.time, opts.season);
  const scene = buildGarden(C, renderer.capabilities.getMaxAnisotropy());
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue("--fd-color-surface").trim();
  const ink = cs.getPropertyValue("--fd-color-text").trim();
  const pass = createInkPass({
    paper,
    ink,
    sky: C.sky,
    edge: opts.time === "night" ? C.mist : paper,
  });

  const camera = new PerspectiveCamera(46, 1, 0.05, 400);
  const narrow = matchMedia("(max-width: 640px)");

  /** 最初の和紙（プロフィール）を、画面に収まる距離から正面に見る */
  function aim(): void {
    const st = STATIONS[0]!;
    const text = narrow.matches ? TEXT.narrow : TEXT.wide;
    const w = text.w / PX + PAPER_PAD.w;
    const h = text.h / PX + PAPER_PAD.h;
    const fov = portrait() ? 62 : 46;
    const t2 = 2 * Math.tan((fov * Math.PI) / 360);
    const d = Math.max(2.1, w / (portrait() ? 0.92 : 0.46) / (t2 * camera.aspect), h / 0.56 / t2);
    const c = new Vector3(...st.pos);
    const n = new Vector3(Math.sin(st.rot), 0, Math.cos(st.rot));
    camera.fov = fov;
    camera.position
      .copy(c)
      .addScaledVector(n, d)
      .add(new Vector3(0, 0.05, 0));
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  }

  function draw(): void {
    renderer.render(scene, camera);
    renderer.copyFramebufferToTexture(target);
    renderer.render(pass.scene, pass.camera);
  }

  let target: FramebufferTexture;
  let size = { w: 0, h: 0 };
  function resize(): void {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    const sz = renderer.getDrawingBufferSize(new Vector2());
    target = new FramebufferTexture(sz.x, sz.y);
    pass.setTarget(target, renderer.getPixelRatio(), w, h);
    camera.aspect = w / h;
    aim();
    draw();
  }

  addEventListener("resize", resize);
  resize();
  return true;
}
