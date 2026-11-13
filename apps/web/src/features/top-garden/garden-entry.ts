// 場面の束で最初に動くファイル。トップの head の inline script が、庭を出すときだけ読み込む。
// 庭を描けないときは、束の読み込みに失敗したときと同じく、ふつうのページに戻す。
import { startGarden } from "./garden";
import type { Season, TimeOfDay } from "./season";

function boot(): void {
  const root = document.documentElement;
  if (!root.classList.contains("stage-on")) return;
  const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
  // data-season と data-time は、head の inline script が、決めた値のどれかを必ず書いている。
  const opts = { season: root.dataset.season as Season, time: root.dataset.time as TimeOfDay };
  if (!stage || !startGarden(stage, opts)) root.classList.remove("stage-on", "intro");
}

// 束は head に足した script なので、body を読み終える前に動くことがある。
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
