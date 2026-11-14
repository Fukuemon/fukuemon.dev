// 場面のバンドルで最初に動くファイル。トップの head の inline script が、庭を出すときだけ読み込む。
// 庭を描けないときは、バンドルの読み込みに失敗したときと同じく、ふつうのページに戻す。
// 描く途中で例外が出たときも、ページが canvas に覆われたままにならないよう、ふつうのページに戻す。
import { startGarden, type Garden } from "./garden";
import { STATIONS } from "../layout";
import type { Season, TimeOfDay } from "../stage/season";

const root = document.documentElement;
const wiring = new AbortController();
const on = { signal: wiring.signal };

/** 庭の操作を外し、ふつうのページに戻す。庭を描けないときと「文だけで読む」で呼ぶ */
function leave(cards: readonly HTMLElement[]): void {
  wiring.abort();
  for (const el of cards) el.classList.remove("is-current");
  root.classList.remove("stage-on", "intro", "enter", "scene-ready", "garden-ready", "no-anim");
}

/** 庭の中のボタン、矢印キー、セクションへのフォーカスで、和紙の間を移る */
function wire(garden: Garden, cards: readonly HTMLElement[]): void {
  const nav = document.querySelector<HTMLElement>("[data-garden-nav]");
  const live = document.querySelector<HTMLElement>("[data-garden-live]");
  const stops = [...(nav?.querySelectorAll<HTMLButtonElement>("[data-station]") ?? [])];
  const pause = nav?.querySelector<HTMLButtonElement>("[data-garden-pause]");
  const plain = nav?.querySelector<HTMLButtonElement>("[data-garden-plain]");

  const select = (i: number, announce: boolean) => {
    const s = garden.go(i);
    stops.forEach((b, k) => b.setAttribute("aria-current", String(k === s)));
    cards.forEach((el, k) => el.classList.toggle("is-current", k === s));
    // 見えなくなった和紙にフォーカスが残らないよう、移った先のボタンへフォーカスを移す。
    const focused = document.activeElement;
    if (focused && cards.some((el, k) => k !== s && el.contains(focused))) stops[s]?.focus();
    if (!announce || !live) return;
    // 同じ見出しを続けて書いても読み上げられるよう、いったん空にしてから書く。
    live.textContent = "";
    requestAnimationFrame(() => {
      live.textContent = cards[s]?.querySelector("h1, h2")?.textContent?.trim() ?? "";
    });
  };
  stops.forEach((b, i) => b.addEventListener("click", () => select(i, true), on));
  cards.forEach((el, i) =>
    el.addEventListener(
      "focusin",
      () => {
        if (garden.current() !== i) select(i, false);
      },
      on,
    ),
  );
  addEventListener(
    "keydown",
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (
        e.target instanceof Element &&
        e.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      if (e.key === "ArrowRight") select(garden.current() + 1, true);
      else if (e.key === "ArrowLeft") select(garden.current() - 1, true);
    },
    on,
  );
  pause?.addEventListener(
    "click",
    () => {
      const pressed = pause.getAttribute("aria-pressed") !== "true";
      pause.setAttribute("aria-pressed", String(pressed));
      garden.pause(pressed);
    },
    on,
  );
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  addEventListener(
    "pointermove",
    (e) => {
      if (fine.matches)
        garden.pointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    },
    on,
  );
  plain?.addEventListener(
    "click",
    () => {
      try {
        garden.stop();
      } catch (e) {
        console.error(e);
      } finally {
        leave(cards);
        cards[0]?.querySelector<HTMLElement>("h1")?.focus();
      }
    },
    on,
  );
  select(0, false);
}

/** 和紙の文、ヘッダー、庭の中のボタンを出し、和紙の間を移れるようにする */
function reveal(garden: Garden, cards: readonly HTMLElement[]): void {
  wire(garden, cards);
  root.classList.add("garden-ready");
}

/**
 * 墨の絵を描き終えるのを待ち、色を差して門をくぐる。
 * 「飛ばす」のボタン、Esc、Tab では、動かさずに最後の状態にする。
 * Tab は既定の動きを止めず、最後の状態でそのまま次の要素へフォーカスを移す。
 */
function runIntro(garden: Garden, cards: readonly HTMLElement[]): void {
  const introWiring = new AbortController();
  const introOn = { signal: introWiring.signal };
  wiring.signal.addEventListener("abort", () => introWiring.abort(), introOn);
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    reveal(garden, cards);
  };
  const finish = () => {
    introWiring.abort();
    root.classList.remove("intro", "enter");
    performance.mark("garden-intro-done");
  };
  const jump = (focusHeading: boolean) => {
    // 文とヘッダーの不透明度の遷移も止め、最後の状態を 1 度に出す。値が落ち着いた後に外す。
    root.classList.add("no-anim");
    garden.skip();
    // 最後の状態を描く途中で描けなくなると、leave がふつうのページに戻している。class を付け直さない。
    if (wiring.signal.aborted) return;
    show();
    finish();
    if (focusHeading) cards[0]?.querySelector<HTMLElement>("h1")?.focus();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));
  };
  document
    .querySelector("[data-garden-skip]")
    ?.addEventListener("click", () => jump(true), introOn);
  addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" || e.key === "Tab") jump(false);
    },
    introOn,
  );
  // 墨の線と署名の遷移は、最初にスタイルが付いた時点から動くので、HTML が遅く届くとその分だけ後ろにずれる。開いてからの時刻で待たず、遷移が終わるのを待つ。
  const drawing =
    document.querySelector("[data-garden-stage] .ink-gate")?.getAnimations({ subtree: true }) ?? [];
  void Promise.allSettled(drawing.map((a) => a.finished)).then(() => {
    if (introWiring.signal.aborted) return;
    root.classList.add("enter");
    performance.mark("garden-enter");
    garden.enter({ cards: show, done: finish });
  });
}

function boot(): void {
  if (!root.classList.contains("stage-on")) return;
  const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
  // 和紙を掛ける木は STATIONS の順なので、セクションを文書の順でなく id で引く。
  const cards = STATIONS.map(({ id }) =>
    document.querySelector<HTMLElement>(`[data-garden-card][aria-labelledby="${id}"]`),
  ).filter((el) => el !== null);
  // data-season と data-time は、head の inline script が、決めた値のどれかを必ず書いている。
  const intro = root.classList.contains("intro");
  const opts = {
    season: root.dataset.season as Season,
    time: root.dataset.time as TimeOfDay,
    intro,
  };
  let garden: Garden | null = null;
  try {
    if (cards.length !== STATIONS.length) console.warn("和紙に置くセクションが足りない");
    else if (stage !== null) garden = startGarden(stage, opts, cards, () => leave(cards));
  } catch (e) {
    console.error(e);
  }
  if (!garden) {
    leave(cards);
    return;
  }
  root.classList.add("scene-ready");
  performance.mark("garden-scene-ready");
  if (intro) runIntro(garden, cards);
  else reveal(garden, cards);
}

// 紙と墨の色は、スタイルシートのトークンから読む。バンドルはスタイルシートより先に動くことがあるので、load を待つ。
if (document.readyState === "complete") boot();
else addEventListener("load", boot, { once: true });
