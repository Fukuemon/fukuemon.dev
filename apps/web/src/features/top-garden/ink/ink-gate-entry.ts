// 墨の絵と署名のファイル。トップの head の inline script が、イントロを出すときだけ読み込む。
// 墨の絵と署名を `.ink-gate` に挿入し、html の class `ink-ready` を付ける。挿入した時点から、線を描く遷移が動く。
// イントロを出さなくなった後（6 秒のタイムアウト、`ink-failed`、飛ばした後）に届いたときは、何も書かない。
import fragment from "virtual:ink-gate";

const root = document.documentElement;

function insert(): void {
  if (!root.classList.contains("intro") || root.classList.contains("ink-failed")) return;
  const gate = document.querySelector(".ink-gate");
  if (!gate) return;
  gate.insertAdjacentHTML("beforeend", fragment);
  root.classList.add("ink-ready");
  performance.mark("ink-ready");
}

// head の module の script は、本文を読み終える前に動くことがある。`.ink-gate` が DOM に入るのを待つ。
if (document.readyState === "loading") addEventListener("DOMContentLoaded", insert, { once: true });
else insert();
