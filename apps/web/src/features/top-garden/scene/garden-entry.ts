// 場面のバンドルで最初に動くファイル。トップの head の inline script が、庭を出すときだけ読み込む。
// 庭を描けないときは、バンドルの読み込みに失敗したときと同じく、ふつうのページに戻す。
// 描く途中で例外が出たときも、ページが canvas に覆われたままにならないよう、ふつうのページに戻す。
import { startGarden, type Garden } from "./garden";
import type { Season, TimeOfDay } from "../stage/season";

const root = document.documentElement;
const leave = () => root.classList.remove("stage-on", "intro", "garden-ready");

/** 庭の中のボタン、矢印キー、セクションへのフォーカスで、和紙の間を移る */
function wire(garden: Garden, cards: readonly HTMLElement[]): void {
  const nav = document.querySelector<HTMLElement>("[data-garden-nav]");
  const live = document.querySelector<HTMLElement>("[data-garden-live]");
  const tabs = [...(nav?.querySelectorAll<HTMLButtonElement>("[data-station]") ?? [])];
  const pause = nav?.querySelector<HTMLButtonElement>("[data-garden-pause]");
  const plain = nav?.querySelector<HTMLButtonElement>("[data-garden-plain]");
  // 「文だけで読む」で、庭の操作の listener をまとめて外す。
  const wiring = new AbortController();
  const on = { signal: wiring.signal };

  const select = (i: number, announce: boolean) => {
    const s = garden.go(i);
    tabs.forEach((b, k) => b.setAttribute("aria-current", String(k === s)));
    cards.forEach((el, k) => el.classList.toggle("is-current", k === s));
    const heading = cards[s]?.querySelector("h1, h2")?.textContent?.trim();
    if (announce && live && heading) live.textContent = heading;
  };
  tabs.forEach((b, i) => b.addEventListener("click", () => select(i, true), on));
  cards.forEach((el, i) =>
    el.addEventListener(
      "focusin",
      () => {
        if (garden.station() !== i) select(i, false);
      },
      on,
    ),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (
      e.target instanceof Element &&
      e.target.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (e.key === "ArrowRight") select(garden.station() + 1, true);
    else if (e.key === "ArrowLeft") select(garden.station() - 1, true);
  };
  addEventListener("keydown", onKey, on);
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
  const onPointer = (e: PointerEvent) => {
    if (fine.matches)
      garden.pointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  };
  addEventListener("pointermove", onPointer, on);
  plain?.addEventListener("click", () => {
    wiring.abort();
    try {
      garden.stop();
    } finally {
      cards.forEach((el) => el.classList.remove("is-current"));
      leave();
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  });
  select(0, false);
}

function boot(): void {
  if (!root.classList.contains("stage-on")) return;
  const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
  const cards = [...document.querySelectorAll<HTMLElement>("[data-garden-card]")];
  // data-season と data-time は、head の inline script が、決めた値のどれかを必ず書いている。
  const opts = { season: root.dataset.season as Season, time: root.dataset.time as TimeOfDay };
  let garden: Garden | null = null;
  try {
    garden = stage === null ? null : startGarden(stage, opts, cards);
  } catch (e) {
    console.error(e);
  }
  if (!garden) {
    leave();
    return;
  }
  wire(garden, cards);
  root.classList.add("garden-ready");
}

// 紙と墨の色は、スタイルシートのトークンから読む。バンドルはスタイルシートより先に動くことがあるので、load を待つ。
if (document.readyState === "complete") boot();
else addEventListener("load", boot, { once: true });
