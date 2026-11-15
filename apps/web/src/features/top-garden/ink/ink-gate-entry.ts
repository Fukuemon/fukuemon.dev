// 墨の絵と署名のファイル。トップの head の inline script が、最初の訪問のイントロを出すときだけ読み込む。
// 墨の絵と署名を `.ink-gate` に挿入し、html の class `ink-ready` を付ける。挿入した時点から、線を描く遷移が動く。
// イントロを出さなくなった後（6 秒のタイムアウトか、`ink-failed`）に届いたときは、何もしない。
import fragment from "virtual:ink-gate";

const root = document.documentElement;
const gate = document.querySelector(".ink-gate");
if (gate && root.classList.contains("intro") && !root.classList.contains("ink-failed")) {
  gate.insertAdjacentHTML("beforeend", fragment);
  root.classList.add("ink-ready");
  performance.mark("ink-ready");
} else {
  root.classList.add("ink-failed");
}
