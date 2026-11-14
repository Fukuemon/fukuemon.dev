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
import { CAM0, DESIGN, PAPER_PAD, PX, STATIONS } from "../layout";
import { hangPaper } from "./paper";
import { scenePalette } from "./scene-colors";
import { buildGarden } from "./scene";
import type { SeasonTime } from "../stage/season";

/** 庭を描き始めた後に、ページの側から操作する口 */
export interface Garden {
  /** `i` 番目の和紙へカメラを動かす。範囲の外は、端から反対の端へ回す。@returns 移った先の番号 */
  go(i: number): number;
  /** 今いる和紙の番号 */
  current(): number;
  /** true のあいだ、カメラを動かさずに切り替え、ポインタに合わせて揺らさない */
  pause(on: boolean): void;
  /** ポインタの位置（-1〜1）に合わせて、カメラを少し揺らす */
  pointer(x: number, y: number): void;
  /**
   * 最初の訪問のイントロで、墨だけの絵から色を差し、カメラが門をくぐって 1 つ目の和紙の前で止まる。
   * @param handlers.cards 文とヘッダーと庭の中のボタンを出す時刻に、1 回呼ぶ
   * @param handlers.done カメラが止まった時刻に、1 回呼ぶ
   */
  enter(handlers: { cards(): void; done(): void }): void;
  /** イントロを、動かさずに最後の状態にする。呼んだ後は、`enter` に渡した関数を呼ばない */
  skip(): void;
  /** 描くのをやめ、セクションを元の場所に戻し、和紙に置いたときに書いた属性と変数を消す */
  stop(): void;
}

/** イントロの、色を差し始めてからの各段の時刻と長さ（ms）。tint0 と move0 は始める時刻、tint と move はその長さ、cards と done は時刻。top-garden の Design Doc の「イントロの各段の時間」 */
const INTRO = { tint0: 300, tint: 1200, move0: 1300, move: 2800, cards: 3700, done: 4500 } as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const webglAvailable = () => document.createElement("canvas").getContext("webgl2") !== null;

/**
 * 庭を `stage` の中の canvas に描き、`cards` を STATIONS の順に和紙に置く。
 * @param cards プロフィールの 4 つのセクション。STATIONS と同じ順に並べる
 * @param onBroken 描き始めた後に、フレームを描く途中の例外、和紙を掛け直す途中の例外、WebGL のコンテキストの喪失で描けなくなったときに呼ぶ。呼ぶ前に、`stop` と同じく元に戻す
 * @returns 描き始めたら操作する口。canvas が無いときと WebGL を使えないときは、何も変えずに null を返す
 * @throws 場面を組み立てる途中の例外は、セクションと html を元に戻してから投げる
 */
export function startGarden(
  stage: HTMLElement,
  opts: SeasonTime & {
    /** true のときは、墨だけの絵を最初のカメラで描いて待つ。`enter` で色を差して門をくぐる */
    readonly intro: boolean;
  },
  cards: readonly HTMLElement[],
  onBroken: () => void,
): Garden | null {
  const canvas = stage.querySelector("canvas");
  if (!canvas || !webglAvailable()) return null;
  const portrait = () => stage.clientWidth < stage.clientHeight;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  } catch (e) {
    console.warn(e);
    return null;
  }

  const vars = document.documentElement.style;
  const sceneVars = new Map<string, string>();
  const homes = cards.map((el) => ({ parent: el.parentNode, next: el.nextSibling }));
  const cssRenderer = new CSS3DRenderer();
  let raf = 0;
  let stopped = false;
  /** イントロの文を出す時刻と終える時刻のタイマー */
  const timers: ReturnType<typeof setTimeout>[] = [];
  const listeners = new AbortController();

  /** 和紙に置く前の状態に戻す。何度呼んでもよい */
  function cleanup(): void {
    stopped = true;
    cancelAnimationFrame(raf);
    listeners.abort();
    for (const id of timers) clearTimeout(id);
    // 後ろのセクションから戻す。次の兄弟が、まだ戻していないセクションを指さないようにするためである。
    for (let i = cards.length - 1; i >= 0; i--) {
      const el = cards[i]!;
      el.removeAttribute("style");
      el.removeAttribute("draggable");
      homes[i]!.parent?.insertBefore(el, homes[i]!.next);
    }
    cssRenderer.domElement.remove();
    for (const k of sceneVars.keys()) vars.removeProperty(k);
    // 場面のテクスチャと絵の GPU のメモリを、ページを閉じるまで残さないよう、コンテキストごと捨てる。
    renderer.dispose();
    renderer.forceContextLoss();
  }
  const broken = (e: unknown) => {
    if (stopped) return;
    console.error(e);
    cleanup();
    onBroken();
  };

  try {
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
    sceneVars
      .set("--scene-paper", C.paper)
      .set("--scene-text", C.text)
      .set("--scene-link", C.link)
      .set("--scene-pad-x", `${(PAPER_PAD.w / 2) * PX}px`)
      .set("--scene-pad-y", `${(PAPER_PAD.h / 2) * PX}px`);
    for (const [k, v] of sceneVars) vars.setProperty(k, v);

    cssRenderer.domElement.classList.add("garden-cards");
    stage.appendChild(cssRenderer.domElement);
    const cssScene = new Scene();
    const slots = cards.map((el, i) => {
      const st = STATIONS[i]!;
      const o = new CSS3DObject(el);
      o.position.set(...st.pos);
      o.rotation.y = st.rot;
      o.scale.setScalar(1 / PX);
      cssScene.add(o);
      return {
        w: 0,
        h: 0,
        unhang: () => {},
        c: new Vector3(...st.pos),
        n: new Vector3(Math.sin(st.rot), 0, Math.cos(st.rot)),
      };
    });
    /** 和紙の大きさをセクションの大きさから測り、和紙と枝を掛け直す */
    const hang = (): void => {
      slots.forEach((p, i) => {
        p.unhang();
        p.w = cards[i]!.offsetWidth / PX;
        p.h = cards[i]!.offsetHeight / PX;
        p.unhang = hangPaper(scene, C, STATIONS[i]!, p.w, p.h, boughFrom[i]!);
      });
      // 光と影を落とす物は掛け直すまで動かないので、影は掛けた後の最初のフレームで 1 回だけ描く。
      renderer.shadowMap.needsUpdate = true;
    };
    renderer.shadowMap.autoUpdate = false;
    hang();
    // セクションの幅は、このブレークポイントをまたいだときだけ変わる（top-garden の Design Doc の「和紙の文」）
    const wide = matchMedia("(min-width: 48rem)");

    const fov = () => (portrait() ? 62 : 46);
    /** `i` 番目の和紙を、画面に収まる距離から正面に見るカメラの位置 */
    const pose = (i: number): { pos: Vector3; look: Vector3 } => {
      const p = slots[i]!;
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
    };

    const tanDesign = Math.tan((DESIGN.fov * Math.PI) / 360);
    /** 墨の絵の SVG と同じ切り取り方になる、最初のカメラの縦の画角（top-garden の Design Doc の「墨の絵と署名の置き方」） */
    const fov0 = (): number => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const a = w / h;
      const svgW = a >= 16 / 9 ? w : a >= 1 ? (h * 16) / 9 : w * 1.25;
      return (Math.atan((tanDesign * h) / ((svgW * 9) / 16)) * 360) / Math.PI;
    };
    const cam0 = () => ({ pos: new Vector3(...CAM0.pos), look: new Vector3(...CAM0.look) });

    const state = { current: 0, paused: false, px: 0, py: 0, last: 0 };
    /** wait は墨だけの絵で待つ間、enter は色を差して門をくぐる間、garden は和紙の間を移る間 */
    let phase: "wait" | "enter" | "garden" = opts.intro ? "wait" : "garden";
    let enteredAt = 0;
    const cur = opts.intro ? cam0() : pose(0);
    pass.setTint(opts.intro ? 0 : 1);
    let target: FramebufferTexture | null = null;

    const render = (): void => {
      renderer.render(scene, camera);
      renderer.copyFramebufferToTexture(target!);
      renderer.render(pass.scene, pass.camera);
      cssRenderer.render(cssScene, camera);
    };

    /** 門をくぐる間のカメラと淡彩を、色を差し始めてからの時刻で決める。@returns カメラの縦の画角 */
    const drawEnter = (now: number): number => {
      const t = now - enteredAt;
      const m = easeInOut(clamp01((t - INTRO.move0) / INTRO.move));
      const start = cam0();
      const end = pose(0);
      pass.setTint(clamp01((t - INTRO.tint0) / INTRO.tint));
      cur.pos.copy(start.pos.lerp(end.pos, m));
      cur.look.copy(start.look.lerp(end.look, m));
      return fov0() + (fov() - fov0()) * m;
    };
    /** イントロを終え、和紙の間を移る動きに切り替える。フレームが遅れても、カメラはそこから 1 つ目の和紙へ寄る */
    const toGarden = (): void => {
      for (const id of timers) clearTimeout(id);
      phase = "garden";
      pass.setTint(1);
    };

    const draw = (now: number): void => {
      const dt = state.last ? Math.min(100, now - state.last) : 16;
      state.last = now;
      if (phase !== "garden") {
        camera.fov = phase === "enter" ? drawEnter(now) : fov0();
        camera.position.copy(cur.pos);
        camera.lookAt(cur.look);
        camera.updateProjectionMatrix();
        render();
        if (phase === "enter") kick();
        else state.last = 0;
        return;
      }
      const tgt = pose(state.current);
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
      render();
      const moving = cur.pos.distanceTo(tgt.pos) + cur.look.distanceTo(tgt.look) > 0.003;
      if (moving) kick();
      else state.last = 0;
    };
    // requestAnimationFrame の中の例外は startGarden の呼び出し元に届かないので、ここで受けて元に戻す。
    const frame = (now: number): void => {
      raf = 0;
      if (stopped || !target) return;
      try {
        draw(now);
      } catch (e) {
        broken(e);
      }
    };
    const kick = (): void => {
      if (!raf && !stopped) raf = requestAnimationFrame(frame);
    };

    let size = { w: 0, h: 0 };
    const resize = (): void => {
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
    };

    const on = { signal: listeners.signal };
    addEventListener("resize", resize, on);
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        pass.setColors(inkColors());
        kick();
      },
      on,
    );
    wide.addEventListener(
      "change",
      () => {
        // 掛け直す途中で止まると和紙の欠けた場面が残るので、フレームの例外と同じく元に戻す。
        try {
          hang();
          kick();
        } catch (e) {
          broken(e);
        }
      },
      on,
    );
    canvas.addEventListener("webglcontextlost", () => broken("WebGL のコンテキストを失った"), on);
    resize();
    // 最初の 1 枚は、load の後にすぐ出す。次のフレームを待つと、canvas が空のまま 1 フレーム見える。
    cancelAnimationFrame(raf);
    raf = 0;
    draw(performance.now());

    return {
      go(i) {
        const n = slots.length;
        const next = ((i % n) + n) % n;
        if (next === state.current) return next;
        state.current = next;
        kick();
        return state.current;
      },
      current: () => state.current,
      pause(paused) {
        state.paused = paused;
        kick();
      },
      pointer(x, y) {
        state.px = x;
        state.py = y;
        if (!state.paused && !portrait()) kick();
      },
      enter(handlers) {
        if (phase !== "wait") return;
        phase = "enter";
        enteredAt = performance.now();
        // 文を出す時刻と終える時刻は、フレームでなく時刻で決める。描くのが遅い端末でも、決めた長さで終える。
        timers.push(
          setTimeout(() => handlers.cards(), INTRO.cards),
          setTimeout(() => {
            toGarden();
            kick();
            handlers.done();
          }, INTRO.done),
        );
        kick();
      },
      skip() {
        if (phase === "garden") return;
        toGarden();
        const p = pose(state.current);
        cur.pos.copy(p.pos);
        cur.look.copy(p.look);
        // 次のフレームを待たずに、最後の状態を描く。
        cancelAnimationFrame(raf);
        raf = 0;
        frame(performance.now());
      },
      stop: cleanup,
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}
