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
  root.classList.remove("stage-on", "intro", "garden-ready");
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

function boot(): void {
  if (!root.classList.contains("stage-on")) return;
  const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
  // 和紙を掛ける木は STATIONS の順なので、セクションを文書の順でなく id で引く。
  const cards = STATIONS.map(({ id }) =>
    document.querySelector<HTMLElement>(`[data-garden-card][aria-labelledby="${id}"]`),
  ).filter((el) => el !== null);
  // data-season と data-time は、head の inline script が、決めた値のどれかを必ず書いている。
  const opts = { season: root.dataset.season as Season, time: root.dataset.time as TimeOfDay };
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
  wire(garden, cards);
  root.classList.add("garden-ready");
}

// 紙と墨の色は、スタイルシートのトークンから読む。バンドルはスタイルシートより先に動くことがあるので、load を待つ。
if (document.readyState === "complete") boot();
else addEventListener("load", boot, { once: true });
