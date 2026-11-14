// console.* の引数を、JSON にできる値の木に写す。Node の preload（console-trace.cjs）と、プレビューに入れるスクリプト（src/preview-console.ts）が共有する。
// 木の形は src/console-records.ts が読む。呼んだ時点の値を写し、getter、toJSON、Proxy の罠を動かさない (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
"use strict";

/** 値の木の深さ。超えた入れ子は、中身を写さずに文字にする。 */
const MAX_DEPTH = 6;
/** 1 つの配列、オブジェクト、Map、Set から写す要素の数。 */
const MAX_ITEMS = 100;
/** 1 つの文字列から写す文字数。 */
const MAX_STRING = 10000;
/** 1 回の呼び出しで写す値の数と文字数。1 行の記録が、記録の行を抜き出す処理の上限を超えないようにする。 */
const MAX_NODES = 2000;
const MAX_CHARS = 256 * 1024;
/** Error の stack から写す、呼び出し元のフレームの行の数。 */
const MAX_STACK = 30;

const ELLIPSIS = "…";

/**
 * args を値の木の配列にする。describe は、実行する場所に固有の値（Proxy、DOM の要素）を文字にする関数で、当てはまらないときは undefined を返す。
 * 数は、NaN、Infinity、-0 を JSON で運べるよう、文字で持つ。
 */
function toConsoleValues(args, describe) {
  const budget = { nodes: MAX_NODES, chars: MAX_CHARS };
  const ancestors = [];

  const text = (value) => ({ kind: "text", value });

  const cut = (value) => {
    const limit = Math.max(0, Math.min(MAX_STRING, budget.chars));
    const kept = value.length > limit ? value.slice(0, limit) + ELLIPSIS : value;
    budget.chars -= kept.length;
    return kept;
  };

  const rest = (count) => text(`${ELLIPSIS}ほか ${count} 件`);

  const tagOf = (value) => Object.prototype.toString.call(value).slice(8, -1);

  const classNameOf = (value) => {
    const proto = Object.getPrototypeOf(value);
    if (proto === null) return "Object";
    const ctor = Object.getOwnPropertyDescriptor(proto, "constructor");
    return ctor && typeof ctor.value === "function" && typeof ctor.value.name === "string"
      ? ctor.value.name
      : undefined;
  };

  const functionName = (fn) => {
    const name = Object.getOwnPropertyDescriptor(fn, "name");
    return name && typeof name.value === "string" ? name.value : "";
  };

  const errorOf = (value) => {
    const read = (key) => {
      const own = Object.getOwnPropertyDescriptor(value, key);
      if (own) return "value" in own ? own.value : undefined;
      // name は Error.prototype が持つ。継承した getter は動かさない
      for (let proto = Object.getPrototypeOf(value); proto; proto = Object.getPrototypeOf(proto)) {
        const found = Object.getOwnPropertyDescriptor(proto, key);
        if (found) return "value" in found ? found.value : undefined;
      }
      return undefined;
    };
    const name = read("name");
    const message = read("message");
    // V8 の stack は、インスタンスが持つ組み込みの getter なので、例外だけを止めて読む
    let stack;
    try {
      stack = value.stack;
    } catch {
      stack = undefined;
    }
    // V8 は「    at 関数 (場所)」、Firefox と Safari は「関数@場所」の行を並べる。V8 の 1 行目は name と message である
    const lines = typeof stack === "string" ? stack.split("\n") : [];
    const v8 = lines.filter((line) => /^\s+at\s/.test(line));
    const frames = (v8.length > 0 ? v8 : lines.filter((line) => line.includes("@")))
      .slice(0, MAX_STACK)
      .map((line) => cut(line.trim()));
    return {
      kind: "error",
      name: cut(typeof name === "string" ? name : "Error"),
      message: cut(typeof message === "string" ? message : ""),
      ...(frames.length > 0 && { stack: frames }),
    };
  };

  const ownEntries = (value, depth) => {
    const keys = Object.keys(value);
    const entries = [];
    for (const key of keys.slice(0, MAX_ITEMS)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      entries.push({
        key: cut(key),
        // getter は動かさない。DevTools と同じく、読んでいないことを示す
        value: "value" in descriptor ? walk(descriptor.value, depth + 1) : text("(...)"),
      });
    }
    if (keys.length > MAX_ITEMS) {
      entries.push({ key: ELLIPSIS, value: rest(keys.length - MAX_ITEMS) });
    }
    return entries;
  };

  const items = (list, depth) => {
    const out = list.slice(0, MAX_ITEMS).map((item) => walk(item, depth + 1));
    if (list.length > MAX_ITEMS) out.push(rest(list.length - MAX_ITEMS));
    return out;
  };

  function walk(value, depth) {
    budget.nodes -= 1;
    if (budget.nodes < 0) return text(ELLIPSIS);
    switch (typeof value) {
      case "string":
        return { kind: "string", value: cut(value) };
      case "number":
        return { kind: "number", value: Object.is(value, -0) ? "-0" : String(value) };
      case "bigint":
        return { kind: "bigint", value: String(value) };
      case "boolean":
        return { kind: "boolean", value };
      case "undefined":
        return { kind: "undefined" };
      case "symbol":
        return { kind: "symbol", description: cut(value.description ?? "") };
      case "function":
        return { kind: "function", name: cut(functionName(value)) };
      default:
        break;
    }
    if (value === null) return { kind: "null" };
    const described = describe(value);
    if (typeof described === "string") return text(cut(described));
    if (ancestors.includes(value)) return { kind: "circular" };
    const tag = tagOf(value);
    if (depth >= MAX_DEPTH) {
      return text(Array.isArray(value) ? `Array(${value.length})` : tag === "Object" ? "{…}" : tag);
    }
    ancestors.push(value);
    try {
      if (Array.isArray(value)) return { kind: "array", items: items(value, depth) };
      if (value instanceof Error || tag === "Error") return errorOf(value);
      if (value instanceof Map) {
        const all = [...value.entries()];
        const entries = all.slice(0, MAX_ITEMS).map(([key, item]) => ({
          key: walk(key, depth + 1),
          value: walk(item, depth + 1),
        }));
        if (all.length > MAX_ITEMS) {
          entries.push({ key: text(ELLIPSIS), value: rest(all.length - MAX_ITEMS) });
        }
        return { kind: "map", entries };
      }
      if (value instanceof Set) return { kind: "set", items: items([...value], depth) };
      if (value instanceof Date) {
        return text(Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString());
      }
      if (value instanceof RegExp) return text(cut(String(value)));
      if (ArrayBuffer.isView(value)) return text(`${tag}(${value.length ?? value.byteLength})`);
      if (tag === "Promise" || tag === "WeakMap" || tag === "WeakSet" || tag === "WeakRef") {
        return text(tag);
      }
      const className = classNameOf(value);
      return {
        kind: "object",
        ...(className !== undefined && className !== "Object" && { className: cut(className) }),
        entries: ownEntries(value, depth),
      };
    } finally {
      ancestors.pop();
    }
  }

  const values = [];
  for (const arg of args) {
    try {
      values.push(walk(arg, 0));
    } catch {
      // 写せない値は、記録を止めずに印を残す
      values.push(text("(写せない値)"));
    }
  }
  return values;
}

if (typeof module === "object" && module !== null) module.exports = { toConsoleValues };
