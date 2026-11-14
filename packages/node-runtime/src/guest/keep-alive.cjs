// 実行環境の中の Node が --require で読む preload。Unix ドメインソケットに接続している間は、タイマーでプロセスを終了させない。
// WebContainers の中では、Unix ドメインソケットの接続だけを持つプロセスが、クエリの途中で、エラーなしで終了することがある (docs/adr/0053-pglite-database-in-playground.md)
"use strict";

const net = require("node:net");

// タイマーはイベントループを動かし続けるためだけに置くので、何もしない
const KEEP_ALIVE_MS = 60_000;

const hasPath = (options) =>
  typeof options === "object" && options !== null && typeof options.path === "string";

// pg は connect(パス) で呼ぶ。net.connect は、引数を正規化した配列（[options, callback]）を 1 つ目に渡す
const isPathConnect = (first) =>
  typeof first === "string" || hasPath(first) || (Array.isArray(first) && hasPath(first[0]));

// oxlint-disable-next-line typescript/unbound-method -- 包んだ connect から、ソケットを this にして呼ぶ
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  try {
    if (isPathConnect(args[0])) {
      const timer = setInterval(() => undefined, KEEP_ALIVE_MS);
      this.once("close", () => clearInterval(timer));
    }
  } catch {
    // タイマーを置けなくても、訪問者の接続は続ける
  }
  return connect.apply(this, args);
};
