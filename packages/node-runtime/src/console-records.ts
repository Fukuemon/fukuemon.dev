import { createStore } from "./store";
import type { ProcessInfo, Store } from "./types";

export type ConsoleLevel = "debug" | "log" | "info" | "warn" | "error";

/**
 * 記録した 1 つの値。呼んだ時点の値を写した木で、関数、DOM の要素のように写せない値は、名前か文字で持つ。
 * `text` は、ほかの種類に当たらない値と、上限で切った部分の印である。循環した参照は `circular` で持つ。
 */
export type ConsoleRecordValue =
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
  | { kind: "array"; items: readonly ConsoleRecordValue[] }
  | {
      kind: "object";
      className?: string;
      entries: readonly { key: string; value: ConsoleRecordValue }[];
    }
  | {
      kind: "map";
      entries: readonly { key: ConsoleRecordValue; value: ConsoleRecordValue }[];
    }
  | { kind: "set"; items: readonly ConsoleRecordValue[] }
  | { kind: "error"; name: string; message: string; stack?: readonly string[] };

/** 記録を出した側。Node のプロセスは、`start` の `name` を持つ。プレビューは、ページを返したサーバーのポートを持つ。 */
export type ConsoleSource = { kind: "process"; name: string } | { kind: "preview"; port: number };

/** `console.*` の 1 回の呼び出しの記録。time は `Date.now()` のミリ秒である。 */
export type ConsoleRecord = {
  id: string;
  level: ConsoleLevel;
  source: ConsoleSource;
  time: number;
  args: readonly ConsoleRecordValue[];
};

/** preload が記録の行の頭に付ける文字列。guest/console-trace.cjs と同じ値にする (apps/playground/DesignDoc.md の「記録を読む形」)。 */
export const CONSOLE_PREFIX = "@@fd:console ";

/** プレビューに入れるスクリプトが送るメッセージの type。 */
export const PREVIEW_CONSOLE_MESSAGE = "fukuemon:console";

/** 1 つの実行環境が持つコンソールの記録の上限。超えたときは、古いものから捨てる。 */
const MAX_RECORDS = 1000;

/**
 * 1 件の記録の大きさの上限。訪問者のプログラムとプレビューのページも記録を出せるので、写す側（guest/console-value.cjs）の上限を超えた分を捨てる。
 * 深さは、写す側の上限で文字にした値と、Map の鍵の分を足す。
 */
const MAX_DEPTH = 8;
const MAX_NODES = 2100;
const MAX_ARGS = 100;
const MAX_TEXT = 10_001;
const MAX_STACK = 30;

const LEVELS: ReadonlySet<string> = new Set(["debug", "log", "info", "warn", "error"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLevel = (value: unknown): value is ConsoleLevel =>
  typeof value === "string" && LEVELS.has(value);

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_TEXT;

/** 形に合わない値、上限を超えた値に当たったときに、記録の全体を捨てるための印。 */
class Rejected extends Error {}

const reject = (): never => {
  throw new Rejected();
};

const text = (value: unknown) => (isText(value) ? value : reject());

/** 値の木を読む。budget は、1 件の記録で読める値の残りの数である。 */
function toValue(raw: unknown, depth: number, budget: { nodes: number }): ConsoleRecordValue {
  budget.nodes -= 1;
  if (budget.nodes < 0 || depth > MAX_DEPTH || !isObject(raw)) return reject();
  const next = (item: unknown) => toValue(item, depth + 1, budget);
  const list = (items: unknown) =>
    Array.isArray(items) ? items.map((item: unknown) => next(item)) : reject();
  switch (raw.kind) {
    case "string":
    case "text":
    case "bigint":
      return { kind: raw.kind, value: text(raw.value) };
    case "number": {
      const value = Number(text(raw.value));
      return raw.value === "NaN" || !Number.isNaN(value) ? { kind: "number", value } : reject();
    }
    case "boolean":
      return typeof raw.value === "boolean" ? { kind: "boolean", value: raw.value } : reject();
    case "null":
    case "undefined":
    case "circular":
      return { kind: raw.kind };
    case "symbol":
      return { kind: "symbol", description: text(raw.description) };
    case "function":
      return { kind: "function", name: text(raw.name) };
    case "array":
    case "set":
      return { kind: raw.kind, items: list(raw.items) };
    case "object": {
      const entries = Array.isArray(raw.entries)
        ? raw.entries.map((entry: unknown) =>
            isObject(entry) ? { key: text(entry.key), value: next(entry.value) } : reject(),
          )
        : reject();
      return {
        kind: "object",
        ...(raw.className !== undefined && { className: text(raw.className) }),
        entries,
      };
    }
    case "map": {
      const entries = Array.isArray(raw.entries)
        ? raw.entries.map((entry: unknown) =>
            isObject(entry) ? { key: next(entry.key), value: next(entry.value) } : reject(),
          )
        : reject();
      return { kind: "map", entries };
    }
    case "error": {
      const stack =
        raw.stack === undefined
          ? undefined
          : Array.isArray(raw.stack) && raw.stack.length <= MAX_STACK
            ? raw.stack.map((line: unknown) => text(line))
            : reject();
      return {
        kind: "error",
        name: text(raw.name),
        message: text(raw.message),
        ...(stack && { stack }),
      };
    }
    default:
      return reject();
  }
}

/** 記録の中身を読む。形に合わないものと、上限を超えたものは、undefined を返す。 */
export function parseConsoleRecord(
  value: unknown,
): Pick<ConsoleRecord, "level" | "time" | "args"> | undefined {
  if (
    !isObject(value) ||
    !isLevel(value.level) ||
    typeof value.time !== "number" ||
    !Number.isFinite(value.time) ||
    !Array.isArray(value.args) ||
    value.args.length > MAX_ARGS
  ) {
    return undefined;
  }
  const budget = { nodes: MAX_NODES };
  try {
    const args = value.args.map((arg: unknown) => toValue(arg, 0, budget));
    return { level: value.level, time: value.time, args };
  } catch (error) {
    if (error instanceof Rejected) return undefined;
    throw error;
  }
}

/** 記録の行の中身（頭を除いた JSON）を読む。 */
export function parseConsoleLine(line: string) {
  try {
    return parseConsoleRecord(JSON.parse(line));
  } catch {
    return undefined;
  }
}

/** 次の描画の前に run を呼ぶ。返す関数で、呼ぶ前に取り消す。 */
type Schedule = (run: () => void) => () => void;

const nextFrame: Schedule = (run) => {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(run, 16);
  return () => clearTimeout(id);
};

/**
 * コンソールの記録の store。届いた記録は、描画の 1 回分ずつまとめて store に入れる。
 * 1 件ごとに入れると、表示中の全ての行の再描画とレイアウトが、1 件ごとに起きるためである。
 * 記録は、届いた順に並べる。プロセスとプレビューをまたいで時刻の順に並べ直さない。
 */
export function createConsoleRecords({
  max = MAX_RECORDS,
  schedule = nextFrame,
}: { max?: number; schedule?: Schedule } = {}) {
  const store = createStore<readonly ConsoleRecord[]>([]);
  let pending: ConsoleRecord[] = [];
  let count = 0;
  let cancel: (() => void) | undefined;
  let disposed = false;

  const flush = () => {
    cancel = undefined;
    const next = [...store.getSnapshot(), ...pending];
    pending = [];
    store.set(next.length > max ? next.slice(next.length - max) : next);
  };

  const add = (
    parsed: Pick<ConsoleRecord, "level" | "time" | "args"> | undefined,
    source: ConsoleSource,
  ) => {
    if (parsed === undefined || disposed) return;
    count += 1;
    pending.push({ id: String(count), source, ...parsed });
    // 上限を超えて届いた分は、store に入れる前に捨てる
    if (pending.length > max) pending = pending.slice(pending.length - max);
    cancel ??= schedule(flush);
  };

  return {
    store: store as Store<readonly ConsoleRecord[]>,
    /** Node の preload が出した記録の行を受ける。source は、行を出したプロセスである。 */
    acceptLine: (line: string, source: Pick<ProcessInfo, "name">) =>
      add(parseConsoleLine(line), { kind: "process", name: source.name }),
    /** プレビューのページから届いたメッセージを受ける。port は、メッセージを送ったページのサーバーのポートである。 */
    acceptPreviewMessage: (message: unknown, port: number) => {
      if (!isObject(message) || message.type !== PREVIEW_CONSOLE_MESSAGE) return;
      add(parseConsoleRecord(message), { kind: "preview", port });
    },
    dispose: () => {
      disposed = true;
      cancel?.();
      cancel = undefined;
      pending = [];
    },
  };
}
