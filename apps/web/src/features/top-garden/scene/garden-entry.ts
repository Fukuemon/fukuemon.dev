// 場面のバンドルで最初に動くファイル。トップの head の inline script が、庭を出すときだけ読み込む。
// 庭を描けないときは、バンドルの読み込みに失敗したときと同じく、ふつうのページに戻す。
// 描く途中で例外が出たときも、ページが canvas に覆われたままにならないよう、ふつうのページに戻す。
import { startGarden } from "./garden";
import type { Season, TimeOfDay } from "../stage/season";

function boot(): void {
  const root = document.documentElement;
  if (!root.classList.contains("stage-on")) return;
  const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
  // data-season と data-time は、head の inline script が、決めた値のどれかを必ず書いている。
  const opts = { season: root.dataset.season as Season, time: root.dataset.time as TimeOfDay };
  let drawn = false;
  try {
    drawn = stage !== null && startGarden(stage, opts);
  } catch (e) {
    console.error(e);
  }
  if (!drawn) root.classList.remove("stage-on", "intro");
}

// 紙と墨の色は、スタイルシートのトークンから読む。バンドルはスタイルシートより先に動くことがあるので、load を待つ。
if (document.readyState === "complete") boot();
else addEventListener("load", boot, { once: true });
