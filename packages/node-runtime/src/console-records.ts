import { createStore } from "./store";
import type {
  ConsoleLevel,
  ConsoleRecord,
  ConsoleRecordValue,
  ConsoleSource,
  ProcessInfo,
  Store,
} from "./types";

/** プレビューに入れるスクリプトが送るメッセージの type。 */
export const PREVIEW_CONSOLE_MESSAGE = "fukuemon:console";

/** 1 つの実行環境が持つコンソールの記録の上限。超えたときは、古いものから捨てる。 */
const MAX_RECORDS = 1000;

/**
 * 1 件の記録の大きさの上限。訪問者のプログラムとプレビューのページも記録を出せるので、写す側（guest/console-value.cjs）の上限を超えた分を捨てる。
 * 深さは、写す側が中身を写さずに文字にした段を含める。値の数は、写す側の上限に、入れ子ごとに 1 つ足す残りの件数の印の分の余裕を足す。
 * 引数と 1 つの入れ子の要素は、写す側の上限の 100 個に、残りの件数の印を 1 つ足した数まで受ける。
 * 文字数の合計は、写す側の上限の 256 K 字に、切った印と、写す側が数えない文字（数、項目の名前、残りの件数の印）の余裕を足す。
 * プレビューのページの postMessage には大きさの上限が無いので、1 件の記録が持つ文字の全体を数える。
 */
const MAX_DEPTH = 6;
const MAX_NODES = 2100;
const MAX_ITEMS = 101;
const MAX_CHARS = 512 * 1024;
/** 時刻は、HTTP の記録と同じく、0 以上の安全な整数で、今より 1 日を超えて先でないものだけを受ける。 */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
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

type Budget = { nodes: number; chars: number };

/** 1 件の記録で読める値の数と文字数の残り。 */
const createBudget = (): Budget => ({ nodes: MAX_NODES, chars: MAX_CHARS });

/**
 * 配列の要素を、先頭から順に読む。長さを先に確かめ、穴は undefined として読む。
 * map は穴で callback を呼ばないので、穴だけの長い配列を、値の数を減らさずに回してしまう。
 */
function each<T>(items: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return reject();
  const out: T[] = [];
  for (let index = 0; index < items.length; index += 1) out.push(read(items[index]));
  return out;
}

/** 値の木を読む。budget は、1 件の記録で読める値の数と文字数の残りである。 */
function toValue(raw: unknown, depth: number, budget: Budget): ConsoleRecordValue {
  budget.nodes -= 1;
  if (budget.nodes < 0 || depth > MAX_DEPTH || !isObject(raw)) return reject();
  const text = (value: unknown) => {
    if (!isText(value)) return reject();
    budget.chars -= value.length;
    return budget.chars < 0 ? reject() : value;
  };
  const next = (item: unknown) => toValue(item, depth + 1, budget);
  const list = (items: unknown) => each(items, next);
  switch (raw.kind) {
    case "string":
    case "text":
      return { kind: raw.kind, value: text(raw.value) };
    case "bigint": {
      // 写す側は、長い bigint の末尾を「…」にする
      const value = text(raw.value);
      return /^-?\d+…?$/.test(value) ? { kind: "bigint", value } : reject();
    }
    case "number": {
      // 写す側が String(数) で書いた文字だけを受ける。Number は、空の文字や 16 進数の文字も数にする
      const source = text(raw.value);
      const value = Number(source);
      return source === "-0" || String(value) === source ? { kind: "number", value } : reject();
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
      const entries = each(raw.entries, (entry) =>
        isObject(entry) ? { key: text(entry.key), value: next(entry.value) } : reject(),
      );
      return {
        kind: "object",
        ...(raw.className !== undefined && { className: text(raw.className) }),
        entries,
      };
    }
    case "map": {
      const entries = each(raw.entries, (entry) =>
        isObject(entry) ? { key: next(entry.key), value: next(entry.value) } : reject(),
      );
      return { kind: "map", entries };
    }
    case "error": {
      const stack =
        raw.stack === undefined
          ? undefined
          : Array.isArray(raw.stack) && raw.stack.length <= MAX_STACK
            ? each(raw.stack, text)
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
    !Number.isSafeInteger(value.time) ||
    (value.time as number) < 0 ||
    (value.time as number) > Date.now() + MAX_FUTURE_MS ||
    !Array.isArray(value.args) ||
    value.args.length > MAX_ITEMS
  ) {
    return undefined;
  }
  const budget = createBudget();
  try {
    const args = each(value.args, (arg) => toValue(arg, 0, budget));
    return { level: value.level, time: value.time as number, args };
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
