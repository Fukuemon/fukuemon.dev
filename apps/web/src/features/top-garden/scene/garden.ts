// 庭を canvas に描き、プロフィールの 4 つのセクションを、木の枝に掛けた和紙に置く。
// カメラが動く間とポインタに合わせて揺れる間だけ、フレームごとに描く。止まっている間は描かない。
import {
  FramebufferTexture,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { createInkPass } from "./ink-pass";
import { PAPER_PAD, PX, STATIONS } from "../layout";
import { hangPaper } from "./paper";
import { scenePalette } from "./scene-colors";
import { buildGarden } from "./scene";
import type { SeasonTime } from "../stage/season";

/** 庭を描き始めた後に、ページの側から操作する口 */
export interface Garden {
  /** `i` 番目の和紙へカメラを動かす。範囲の外は、端から反対の端へ回す。@returns 移った先の番号 */
  go(i: number): number;
  /** 今いる和紙の番号 */
  station(): number;
  /** true のあいだ、カメラを動かさずに切り替え、ポインタに合わせて揺らさない */
  pause(on: boolean): void;
  /** ポインタの位置（-1〜1）に合わせて、カメラを少し揺らす */
  pointer(x: number, y: number): void;
  /** 描くのをやめ、セクションを元の場所に戻し、和紙に置いたときのインラインのスタイルを消す */
  stop(): void;
}

const webglAvailable = () => document.createElement("canvas").getContext("webgl2") !== null;

/**
 * 庭を `stage` の中の canvas に描き、`cards` を STATIONS の順に和紙に置く。
 * @param cards プロフィールの 4 つのセクション。STATIONS と同じ順に並べる
 * @returns 描き始めたら操作する口。canvas が無いときと WebGL を使えないときは、何も変えずに null を返す
 * @throws 場面を組み立てる途中の例外は、そのまま投げる
 */
export function startGarden(
  stage: HTMLElement,
  opts: SeasonTime,
  cards: readonly HTMLElement[],
): Garden | null {
  const canvas = stage.querySelector("canvas");
  if (!canvas || !webglAvailable()) return null;
  const portrait = () => stage.clientWidth < stage.clientHeight;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, portrait() ? 1.25 : 1.5));
  renderer.shadowMap.enabled = !portrait();
  renderer.shadowMap.type = PCFSoftShadowMap;

  const C = scenePalette(opts.time, opts.season);
  const { scene, boughFrom } = buildGarden(C, renderer.capabilities.getMaxAnisotropy());
  /** 紙と墨の色を、今のテーマのトークンから読む */
  const inkColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const paper = cs.getPropertyValue("--fd-color-surface").trim();
    const ink = cs.getPropertyValue("--fd-color-text").trim();
    return { paper, ink, sky: C.sky, edge: opts.time === "night" ? C.mist : paper };
  };
  const pass = createInkPass(inkColors());
  const camera = new PerspectiveCamera(46, 1, 0.05, 400);

  // 和紙の色と余白は、セクションの CSS が読む。セクションはまだ stage の外にあるので html に書き、和紙の大きさを測る前に書く。
  const vars = document.documentElement.style;
  const sceneVars: Record<string, string> = {
    "--scene-paper": C.paper,
    "--scene-text": C.text,
    "--scene-link": C.link,
    "--scene-pad-x": `${(PAPER_PAD.w / 2) * PX}px`,
    "--scene-pad-y": `${(PAPER_PAD.h / 2) * PX}px`,
  };
  for (const [k, v] of Object.entries(sceneVars)) vars.setProperty(k, v);

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.classList.add("garden-cards");
  stage.appendChild(cssRenderer.domElement);
  const cssScene = new Scene();
  const homes = cards.map((el) => ({ parent: el.parentNode, next: el.nextSibling }));
  const papers = cards.map((el, i) => {
    const st = STATIONS[i]!;
    const o = new CSS3DObject(el);
    o.position.set(...st.pos);
    o.rotation.y = st.rot;
    o.scale.setScalar(1 / PX);
    cssScene.add(o);
    const w = el.offsetWidth / PX;
    const h = el.offsetHeight / PX;
    hangPaper(scene, C, st, w, h, boughFrom[i]!);
    return {
      w,
      h,
      c: new Vector3(...st.pos),
      n: new Vector3(Math.sin(st.rot), 0, Math.cos(st.rot)),
    };
  });

  const fov = () => (portrait() ? 62 : 46);
  /** `i` 番目の和紙を、画面に収まる距離から正面に見るカメラの位置 */
  function pose(i: number): { pos: Vector3; look: Vector3 } {
    const p = papers[i]!;
    const t2 = 2 * Math.tan((fov() * Math.PI) / 360);
    const aspect = stage.clientWidth / stage.clientHeight;
    const d = Math.max(2.1, p.w / (portrait() ? 0.88 : 0.46) / (t2 * aspect), p.h / 0.56 / t2);
    return {
      pos: p.c
        .clone()
        .addScaledVector(p.n, d)
        .add(new Vector3(0, 0.05, 0)),
      look: p.c.clone(),
    };
  }

  const state = { station: 0, paused: false, px: 0, py: 0, last: 0 };
  const start = pose(0);
  const cur = { pos: start.pos, look: start.look };
  let raf = 0;
  let stopped = false;
  let target: FramebufferTexture | null = null;

  function frame(now: number): void {
    raf = 0;
    if (stopped || !target) return;
    const dt = state.last ? Math.min(100, now - state.last) : 16;
    state.last = now;
    const tgt = pose(state.station);
    // 縦長の画面は和紙が幅いっぱいなので、揺らすと和紙が画面からはみ出る。
    if (!state.paused && !portrait()) {
      tgt.pos.x += state.px * 0.25;
      tgt.pos.y -= state.py * 0.08;
    }
    const k = state.paused ? 1 : 1 - Math.exp(-dt / 260);
    cur.pos.lerp(tgt.pos, k);
    cur.look.lerp(tgt.look, k);
    camera.fov = fov();
    camera.position.copy(cur.pos);
    camera.lookAt(cur.look);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    renderer.copyFramebufferToTexture(target);
    renderer.render(pass.scene, pass.camera);
    cssRenderer.render(cssScene, camera);
    const moving = cur.pos.distanceTo(tgt.pos) + cur.look.distanceTo(tgt.look) > 0.003;
    if (moving) kick();
    else state.last = 0;
  }
  function kick(): void {
    if (!raf && !stopped) raf = requestAnimationFrame(frame);
  }

  let size = { w: 0, h: 0 };
  function resize(): void {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    cssRenderer.setSize(w, h);
    const sz = renderer.getDrawingBufferSize(new Vector2());
    target?.dispose();
    target = new FramebufferTexture(sz.x, sz.y);
    pass.setTarget(target, renderer.getPixelRatio(), w, h);
    camera.aspect = w / h;
    kick();
  }
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const onTheme = () => {
    pass.setColors(inkColors());
    kick();
  };

  addEventListener("resize", resize);
  dark.addEventListener("change", onTheme);
  resize();
  // 最初の 1 枚は、load の後にすぐ出す。次のフレームを待つと、canvas が空のまま 1 フレーム見える。
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  frame(performance.now());

  return {
    go(i) {
      state.station = (i + papers.length) % papers.length;
      kick();
      return state.station;
    },
    station: () => state.station,
    pause(on) {
      state.paused = on;
      kick();
    },
    pointer(x, y) {
      state.px = x;
      state.py = y;
      if (!state.paused) kick();
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      dark.removeEventListener("change", onTheme);
      // 後ろのセクションから戻す。次の兄弟が、まだ戻していないセクションを指さないようにするためである。
      for (let i = cards.length - 1; i >= 0; i--) {
        const el = cards[i]!;
        el.removeAttribute("style");
        homes[i]!.parent?.insertBefore(el, homes[i]!.next);
      }
      cssRenderer.domElement.remove();
      for (const k of Object.keys(sceneVars)) vars.removeProperty(k);
      renderer.dispose();
    },
  };
}
