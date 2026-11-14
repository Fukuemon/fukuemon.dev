// プレビューのページに入れるスクリプトの本体。console.* の 1 回の呼び出しを、ツールのページへ postMessage で送る。
// src/preview-console.ts が、guest/console-value.cjs と一緒に 1 つの関数に包み、toConsoleValues、TOOL_ORIGIN、MESSAGE_TYPE を渡す。
// 元の console.* も呼び、ページの DevTools の出力は変えない。送る処理の失敗は握りつぶす (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
/* global toConsoleValues, TOOL_ORIGIN, MESSAGE_TYPE */

const LEVELS = ["debug", "log", "info", "warn", "error"];

/** DOM の要素とウィンドウは postMessage で送れないので、DevTools の 1 行の形に似せた文字にする。 */
const describe = (value) => {
  if (typeof Window === "function" && value instanceof Window) return "Window";
  if (typeof Node !== "function" || !(value instanceof Node)) return undefined;
  if (!(value instanceof Element)) return value.nodeName;
  const id = value.id ? `#${value.id}` : "";
  const classes = [...value.classList].map((name) => `.${name}`).join("");
  return `<${value.localName}${id}${classes}>`;
};

if (window.parent !== window) {
  for (const level of LEVELS) {
    const original = console[level];
    if (typeof original !== "function") continue;
    console[level] = function (...args) {
      try {
        window.parent.postMessage(
          { type: MESSAGE_TYPE, level, time: Date.now(), args: toConsoleValues(args, describe) },
          TOOL_ORIGIN,
        );
      } catch {
        // 送れなくても、ページのスクリプトは動かす
      }
      return original.apply(this, args);
    };
  }
}
