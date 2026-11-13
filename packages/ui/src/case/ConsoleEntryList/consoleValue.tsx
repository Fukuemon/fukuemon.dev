import type { TreeNode } from "../../base/TreeView/TreeView";

/**
 * コンソールに出す 1 つの値。記録の形には依らず、描き方を変える区別だけを持つ。
 * `function` は名前の分かる関数で、`ƒ name()` と描く。`text` は、ほかの種類に当たらない値（DOM の要素など）を呼ぶ側が文字にしたもので、そのまま描く。
 * 循環した参照は `circular` で渡す。`error` の `stack` は、呼び出し元のフレームの行の並びで、どの行を出すかは呼ぶ側が決める。
 */
export type ConsoleValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bigint"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  | { kind: "undefined" }
  | { kind: "symbol"; description: string }
  | { kind: "function"; name: string }
  | { kind: "text"; value: string }
  | { kind: "circular" }
  | { kind: "array"; items: readonly ConsoleValue[] }
  | { kind: "object"; className?: string; entries: readonly ConsoleProperty[] }
  | { kind: "map"; entries: readonly ConsoleMapEntry[] }
  | { kind: "set"; items: readonly ConsoleValue[] }
  | { kind: "error"; name: string; message: string; stack?: readonly string[] };

export type ConsoleProperty = { key: string; value: ConsoleValue };
export type ConsoleMapEntry = { key: ConsoleValue; value: ConsoleValue };

/** 1 行に並べる要素の数。超えた分は「…」にする。 */
const PREVIEW_ITEMS = 5;

const list = (parts: readonly string[], total: number) =>
  total > parts.length ? [...parts, "…"].join(", ") : parts.join(", ");

const sizeOf = (value: ConsoleValue): number => {
  if (value.kind === "array" || value.kind === "set") return value.items.length;
  if (value.kind === "object" || value.kind === "map") return value.entries.length;
  return 0;
};

/** 開いて中を見られる値か。中身の無い配列とオブジェクトは、1 行で全てが見えるので開かない。 */
export const isExpandable = (value: ConsoleValue): boolean =>
  value.kind === "error" ? (value.stack?.length ?? 0) > 0 : sizeOf(value) > 0;

/**
 * 値を 1 行の文字にする。DevTools のコンソールに合わせ、入れ子の中の文字列は引用符で囲み、
 * 入れ子の中の配列とオブジェクトは中身を書かずに `{…}` や `Array(3)` にする。
 */
export function preview(value: ConsoleValue, isNested = false): string {
  switch (value.kind) {
    case "string":
      return isNested ? JSON.stringify(value.value) : value.value;
    case "number":
      return Object.is(value.value, -0) ? "-0" : String(value.value);
    case "bigint":
      return `${value.value}n`;
    case "boolean":
      return String(value.value);
    case "null":
    case "undefined":
      return value.kind;
    case "symbol":
      return `Symbol(${value.description})`;
    case "function":
      return `ƒ ${value.name || "(anonymous)"}()`;
    case "text":
      return value.value;
    case "circular":
      return "[Circular]";
    case "error":
      return `${value.name}: ${value.message}`;
    case "array": {
      const head = `Array(${value.items.length})`;
      if (isNested) return head;
      const parts = value.items.slice(0, PREVIEW_ITEMS).map((item) => preview(item, true));
      return `${head} [${list(parts, value.items.length)}]`;
    }
    case "set": {
      const head = `Set(${value.items.length})`;
      if (isNested) return head;
      const parts = value.items.slice(0, PREVIEW_ITEMS).map((item) => preview(item, true));
      return `${head} {${list(parts, value.items.length)}}`;
    }
    case "map": {
      const head = `Map(${value.entries.length})`;
      if (isNested) return head;
      const parts = value.entries
        .slice(0, PREVIEW_ITEMS)
        .map((entry) => `${preview(entry.key, true)} => ${preview(entry.value, true)}`);
      return `${head} {${list(parts, value.entries.length)}}`;
    }
    case "object": {
      const head = value.className === undefined ? "" : `${value.className} `;
      if (isNested) return `${head}{…}`;
      const parts = value.entries
        .slice(0, PREVIEW_ITEMS)
        .map((entry) => `${entry.key}: ${preview(entry.value, true)}`);
      return `${head}{${list(parts, value.entries.length)}}`;
    }
  }
}

/** 開いた値の 1 つの子。separator は、key と値の間に置く文字である。 */
type TreeEntry = { key: string; separator: string; value: ConsoleValue };

const childrenOf = (value: ConsoleValue): TreeEntry[] => {
  switch (value.kind) {
    case "array":
    case "set":
      return value.items.map((item, index) => ({
        key: String(index),
        separator: ":",
        value: item,
      }));
    case "object":
      return value.entries.map((entry) => ({ ...entry, separator: ":" }));
    case "map":
      return value.entries.map((entry) => ({
        key: preview(entry.key, true),
        separator: " =>",
        value: entry.value,
      }));
    default:
      return [];
  }
};

const stackNodes = (id: string, stack: readonly string[]): TreeNode[] =>
  stack.map((line, index) => ({
    id: `${id}/stack/${index}`,
    label: line,
    content: <span className="font-mono wrap-anywhere whitespace-pre-wrap">{line}</span>,
  }));

/**
 * 値を TreeView の項目にする。開ける値は枝に、ほかは葉にする。
 * key を渡すと、項目を「key: 値」の形にし、key を太字にする。Map の子は、separator で「key => 値」にする。
 */
export function toTreeNode(
  value: ConsoleValue,
  id: string,
  key?: string,
  separator = ":",
): TreeNode {
  const text = preview(value, key !== undefined && !isExpandable(value));
  const label = key === undefined ? text : `${key}${separator} ${text}`;
  const content = (
    <span className="font-mono wrap-anywhere">
      {key !== undefined && (
        <span className="font-bold">
          {key}
          {separator}
        </span>
      )}
      {key !== undefined && " "}
      {text}
    </span>
  );
  if (!isExpandable(value)) return { id, label, content };
  const children =
    value.kind === "error"
      ? stackNodes(id, value.stack ?? [])
      : childrenOf(value).map((child, index) =>
          toTreeNode(child.value, `${id}/${index}`, child.key, child.separator),
        );
  return { id, label, content, children };
}
