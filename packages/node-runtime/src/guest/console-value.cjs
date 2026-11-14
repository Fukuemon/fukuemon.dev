// console.* の引数を、JSON にできる値の木に写す。Node の preload（console-trace.cjs）と、プレビューに入れるスクリプト（src/preview-console.ts）が共有する。
// 木の形は src/console-records.ts が読む。呼んだ時点の値を写し、getter、toJSON、Proxy の罠を動かさない (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
"use strict";

/** 値の木の深さ。超えた入れ子は、中身を写さずに文字にする。 */
const MAX_DEPTH = 6;
/** 1 回の呼び出しから写す引数の数と、1 つの配列、オブジェクト、Map、Set から写す要素の数。 */
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
 * 呼んでよい組み込みの stack の getter。V8 はインスタンスに、Firefox は Error.prototype に定義する。
 * Function.prototype.toString の「[native code]」で見分けると、bind した訪問者の関数も通るので、同じ関数かで比べる。
 */
const stackGetters = new Set(
  [new Error(), Error.prototype]
    .map((target) => Object.getOwnPropertyDescriptor(target, "stack"))
    // oxlint-disable-next-line typescript/unbound-method -- 取り出した getter は、call で値を this にして呼ぶ
    .map((descriptor) => descriptor && descriptor.get)
    .filter((get) => typeof get === "function"),
);

/** 組み込みの getter を、訪問者が上書きしたメソッドを通さずに呼ぶ。 */
// oxlint-disable-next-line typescript/unbound-method -- 取り出した getter は、call で値を this にして呼ぶ
const builtinGetter = (proto, key) => Object.getOwnPropertyDescriptor(proto, key).get;
const mapSize = builtinGetter(Map.prototype, "size");
const setSize = builtinGetter(Set.prototype, "size");
const typedArrayLength = builtinGetter(Object.getPrototypeOf(Uint8Array.prototype), "length");
const viewByteLength = builtinGetter(DataView.prototype, "byteLength");
const regexpSource = builtinGetter(RegExp.prototype, "source");
/** RegExp.prototype.toString は、サブクラスが上書きできる source と flags を読むので、フラグの組み込みの getter から組む。 */
const regexpFlags = [
  ["d", "hasIndices"],
  ["g", "global"],
  ["i", "ignoreCase"],
  ["m", "multiline"],
  ["s", "dotAll"],
  ["u", "unicode"],
  ["v", "unicodeSets"],
  ["y", "sticky"],
].flatMap(([flag, key]) =>
  Object.getOwnPropertyDescriptor(RegExp.prototype, key)
    ? [[flag, builtinGetter(RegExp.prototype, key)]]
    : [],
);
const regexpText = (value) =>
  `/${regexpSource.call(value)}/${regexpFlags
    .filter(([, get]) => get.call(value))
    .map(([flag]) => flag)
    .join("")}`;

/**
 * args を値の木の配列にする。describe は、実行する場所に固有の値（Proxy、DOM の要素）を文字にする関数で、当てはまらないときは undefined を返す。
 * 数は、NaN、Infinity、-0 を JSON で運べるよう、文字で持つ。
 * 値の数を使い切ったら、残りの兄弟を写さずに、残りの件数の印を 1 つだけ足す。値の数は、MAX_NODES に、開いている入れ子ごとに 1 つの残りの件数の印と、MAX_ITEMS で止めた入れ子ごとに 1 つの印を足した数を超えない。
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

  /** total 個の要素のうち、先頭から写す。上限か値の数で止めたときは、mark で残りの件数の印を足す。 */
  const take = (total, nextItem, mark) => {
    const out = [];
    for (let index = 0; index < total; index += 1) {
      if (index >= MAX_ITEMS || budget.nodes <= 0) {
        out.push(mark(total - index));
        break;
      }
      out.push(nextItem());
    }
    return out;
  };

  const classNameOf = (value) => {
    const proto = Object.getPrototypeOf(value);
    if (proto === null) return "Object";
    const ctor = Object.getOwnPropertyDescriptor(proto, "constructor");
    return ctor && typeof ctor.value === "function"
      ? functionName(ctor.value) || undefined
      : undefined;
  };

  const functionName = (fn) => {
    const name = Object.getOwnPropertyDescriptor(fn, "name");
    return name && typeof name.value === "string" ? name.value : "";
  };

  /** key を、自分か継承した記述子から読む。getter は、組み込みの stack の getter だけを呼ぶ。 */
  const readProperty = (value, key) => {
    for (let target = value; target; target = Object.getPrototypeOf(target)) {
      const found = Object.getOwnPropertyDescriptor(target, key);
      if (!found) continue;
      if ("value" in found) return found.value;
      // oxlint-disable-next-line typescript/unbound-method -- 取り出した getter は、call で値を this にして呼ぶ
      if (key !== "stack" || !stackGetters.has(found.get)) return undefined;
      try {
        return found.get.call(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const errorOf = (value) => {
    const name = readProperty(value, "name");
    const message = readProperty(value, "message");
    const stack = readProperty(value, "stack");
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
    let index = 0;
    return take(
      keys.length,
      () => {
        const key = keys[index++];
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && "value" in descriptor) {
          return { key: cut(key), value: walk(descriptor.value, depth + 1) };
        }
        // getter は動かさない。DevTools と同じく、読んでいないことを示す。読む側は印も値の 1 つと数える
        budget.nodes -= 1;
        return { key: cut(key), value: text("(...)") };
      },
      (count) => ({ key: ELLIPSIS, value: rest(count) }),
    );
  };

  /** 深さの上限で、中身を写さずに出す文字。 */
  const summary = (value) => {
    if (Array.isArray(value)) return `Array(${value.length})`;
    const className = classNameOf(value);
    return className === undefined || className === "Object" ? "{…}" : className;
  };

  function walk(value, depth) {
    budget.nodes -= 1;
    switch (typeof value) {
      case "string":
        return { kind: "string", value: cut(value) };
      case "number":
        return { kind: "number", value: Object.is(value, -0) ? "-0" : String(value) };
      case "bigint":
        return { kind: "bigint", value: cut(String(value)) };
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
    if (depth >= MAX_DEPTH) return text(cut(summary(value)));
    ancestors.push(value);
    try {
      if (Array.isArray(value)) {
        let index = 0;
        const item = () => {
          // 穴は undefined として写す。getter は、オブジェクトの項目と同じく動かさない
          const descriptor = Object.getOwnPropertyDescriptor(value, index++);
          if (descriptor === undefined || "value" in descriptor) {
            return walk(descriptor?.value, depth + 1);
          }
          budget.nodes -= 1;
          return text("(...)");
        };
        return { kind: "array", items: take(value.length, item, rest) };
      }
      if (value instanceof Error) return errorOf(value);
      if (value instanceof Map) {
        const iterator = Map.prototype.entries.call(value);
        const entries = take(
          mapSize.call(value),
          () => {
            const [key, item] = iterator.next().value;
            return { key: walk(key, depth + 1), value: walk(item, depth + 1) };
          },
          (count) => ({ key: text(ELLIPSIS), value: rest(count) }),
        );
        return { kind: "map", entries };
      }
      if (value instanceof Set) {
        const iterator = Set.prototype.values.call(value);
        const items = take(setSize.call(value), () => walk(iterator.next().value, depth + 1), rest);
        return { kind: "set", items };
      }
      if (value instanceof Date) {
        const time = Date.prototype.getTime.call(value);
        return text(Number.isNaN(time) ? "Invalid Date" : Date.prototype.toISOString.call(value));
      }
      if (value instanceof RegExp) return text(cut(regexpText(value)));
      if (ArrayBuffer.isView(value)) {
        const isView = value instanceof DataView;
        const size = isView ? viewByteLength.call(value) : typedArrayLength.call(value);
        return text(cut(`${classNameOf(value) ?? (isView ? "DataView" : "TypedArray")}(${size})`));
      }
      for (const builtin of ["Promise", "WeakMap", "WeakSet", "WeakRef"]) {
        const ctor = globalThis[builtin];
        if (typeof ctor === "function" && value instanceof ctor) return text(builtin);
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

  let index = 0;
  return take(
    args.length,
    () => {
      const arg = args[index++];
      try {
        return walk(arg, 0);
      } catch {
        // 写せない値は、記録を止めずに印を残す
        return text("(写せない値)");
      }
    },
    rest,
  );
}

if (typeof module === "object" && module !== null) module.exports = { toConsoleValues };
