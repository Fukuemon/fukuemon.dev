// 実行環境の中の Node が --require で読む preload。console.* の 1 回の呼び出しを、1 件を 1 行の JSON にして標準出力に書く。
// 行の形は src/console-records.ts が読む。元の console.* も呼び、端末の出力は変えない。記録の処理の失敗は握りつぶす (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
"use strict";

const { types } = require("node:util");

const { toConsoleValues } = require("./console-value.cjs");

const PREFIX = "@@fd:console ";
const LEVELS = ["debug", "log", "info", "warn", "error"];

const describe = (value) => (types.isProxy(value) ? "Proxy" : undefined);

// 記録を書く途中で console.* が呼ばれたとき（stdout の write を包んだ訪問者のコードなど）は、2 重に記録しない
let writing = false;

for (const level of LEVELS) {
  const original = console[level];
  if (typeof original !== "function") continue;
  console[level] = function (...args) {
    if (!writing) {
      writing = true;
      try {
        const record = { level, time: Date.now(), args: toConsoleValues(args, describe) };
        process.stdout.write(PREFIX + JSON.stringify(record) + "\n");
      } catch {
        // 記録できなくても、訪問者のプログラムは動かす
      } finally {
        writing = false;
      }
    }
    return original.apply(this, args);
  };
}
