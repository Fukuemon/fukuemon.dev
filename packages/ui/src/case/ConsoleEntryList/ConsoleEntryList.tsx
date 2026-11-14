import { clsx } from "clsx";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { TreeView } from "../../base/TreeView/TreeView";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";
import { type ConsoleValue, isExpandable, preview, toTreeNode } from "./consoleValue";

export type ConsoleLevel = "debug" | "log" | "info" | "warn" | "error";

/** コンソールの 1 行。`console.*` の 1 回の呼び出しに当たる。 */
export type ConsoleEntry = {
  id: string;
  level: ConsoleLevel;
  /** 出力元の名前。Node のプロセスの名前か、プレビュー。 */
  source: string;
  /** 画面に出す時刻の文字。書式は呼ぶ側が決める。 */
  time?: string;
  args: readonly ConsoleValue[];
};

export type ConsoleEntryListProps = {
  title?: string;
  /** 起きた順に並べた行。上限と古い行の扱いは、呼ぶ側が決める。 */
  entries: readonly ConsoleEntry[];
  /** 最初に表示するログレベル。渡さないと、全てのログレベルを表示する。 */
  defaultLevels?: readonly ConsoleLevel[];
  /** 渡すと、一覧の代わりに、待っている間の空の中身、読み込み中、エラーのどれかを出す。 */
  state?: Extract<ToolPaneState, { kind: "pending" | "loading" | "error" }>;
};

const LEVELS: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

const ROW_CLASS_NAME: Record<ConsoleLevel, string> = {
  debug: "border-transparent",
  log: "border-transparent",
  info: "border-transparent",
  warn: "border-warning bg-warning-surface",
  error: "border-danger bg-danger-surface",
};

const ICON_CLASS_NAME: Record<ConsoleLevel, string> = {
  debug: "text-text-secondary",
  log: "text-text-secondary",
  info: "text-info",
  warn: "text-warning",
  error: "text-danger",
};

/** ログレベルの印。色を見分けられなくても区別できるように、形を変える。log は印を描かず、幅だけを空ける。 */
function LevelIcon({ level }: { level: ConsoleLevel }) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("shrink-0", ICON_CLASS_NAME[level])}
      fill="none"
      height="14"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 16 16"
      width="14"
    >
      {level === "debug" && (
        <g fill="currentColor" stroke="none">
          <circle cx="4" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12" cy="8" r="1.25" />
        </g>
      )}
      {level === "info" && (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7v4.5M8 4.5v1" />
        </>
      )}
      {level === "warn" && <path d="M8 1.5l6.5 12.5h-13zM8 6v4M8 11.5v1" />}
      {level === "error" && (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
        </>
      )}
    </svg>
  );
}

/** 押した状態の印。色のほかに、枠の中の印の有無で、表示しているかを示す。 */
function CheckIcon({ isChecked }: { isChecked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 16 16"
      width="14"
    >
      <rect height="13" width="13" x="1.5" y="1.5" />
      {isChecked && <path d="M4.5 8l2.5 2.5 4.5-5" strokeWidth="2" />}
    </svg>
  );
}

type RowMove = "previous" | "next" | "first" | "last";

const treeItems = (tree: Element | undefined) => [
  ...(tree?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []),
];

type EntryRowProps = {
  entry: ConsoleEntry;
  /** Tab のキーで止まる行か。一覧の中で 1 つの行だけを止まる箇所にする。 */
  isTabStop: boolean;
  /** 行の中にフォーカスが入ったときに、行の id で呼ぶ。 */
  onFocusRow: (id: string) => void;
};

/**
 * コンソールの 1 行。行を 1 つのフォーカスの止まる箇所にし、行の中の値の木へは矢印のキーで入る。
 * 行で右の矢印か Enter を押すと、最初の木の最初の項目へ移る。木の根で左の矢印を押すと、行へ戻る。
 * 木の最初の項目で上の矢印を押すと、前の木の最後の項目か、前の木が無ければ行へ移る。最後の項目で下の矢印を押すと、次の木の最初の項目か、次の木が無ければ次の行へ移る。
 */
function EntryRow({ entry, isTabStop, onFocusRow }: EntryRowProps) {
  const element = useRef<HTMLLIElement>(null);
  // ツリーの項目は文字の上に余白を持つので、値がツリーで始まる行は、印と時刻をその 1 行目にそろえる
  const startsWithTree = entry.args[0] !== undefined && isExpandable(entry.args[0]);
  const treesInRow = () => [...(element.current?.querySelectorAll('[role="tree"]') ?? [])];
  const enterTree = (tree: Element | undefined, at: "first" | "last") => {
    const items = treeItems(tree);
    (at === "first" ? items[0] : items.at(-1))?.focus();
  };
  // 前後と端の行は DOM の並びで探す。一覧から行ごとの関数を渡すと、React Compiler を通すビルドで、一覧が描き直されるたびに、その関数に依存する行の中身を作り直すためである（ADR-0047）
  const moveFocus = (to: RowMove) => {
    const row = element.current;
    const list = row?.parentElement;
    const target = {
      previous: row?.previousElementSibling,
      next: row?.nextElementSibling,
      first: list?.firstElementChild,
      last: list?.lastElementChild,
    }[to];
    if (target instanceof HTMLElement) target.focus();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    // 木の項目から上がってきたキーは、木が扱う
    if (event.target !== event.currentTarget) return;
    const keys: Record<string, () => void> = {
      ArrowUp: () => moveFocus("previous"),
      ArrowDown: () => moveFocus("next"),
      Home: () => moveFocus("first"),
      End: () => moveFocus("last"),
      ArrowRight: () => enterTree(treesInRow()[0], "first"),
      Enter: () => enterTree(treesInRow()[0], "first"),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  // 端に着いた木は、フォーカスのある項目から DOM で探す。React Compiler 1.0.0 は、描画の中で木の番号を `++` で数えると行をコンパイルせず、木ごとに関数を作ると値の木をメモ化しない（ADR-0047）
  const handleEdge = (key: "ArrowUp" | "ArrowDown" | "ArrowLeft") => {
    const trees = treesInRow();
    // TreeView は、キーを押した項目にフォーカスがあるうちに onEdge を呼ぶ
    const treeIndex = trees.findIndex((tree) => tree.contains(document.activeElement));
    if (key === "ArrowDown") {
      if (trees[treeIndex + 1]) enterTree(trees[treeIndex + 1], "first");
      else moveFocus("next");
    } else if (key === "ArrowUp" && trees[treeIndex - 1]) {
      enterTree(trees[treeIndex - 1], "last");
    } else {
      element.current?.focus();
    }
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 行を移る一覧の行は、矢印のキーで前後の行と行の中の木へ移る (context/conventions.md)
    <li
      className={clsx(
        "flex gap-2 border-b border-l-2 border-b-border py-0.5 pr-4 pl-3.5 last:border-b-0 focus-visible:focus-ring-inset",
        ROW_CLASS_NAME[entry.level],
      )}
      onFocus={() => onFocusRow(entry.id)}
      onKeyDown={handleKeyDown}
      ref={element}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 行を移る一覧は、1 つの行だけを Tab のキーの順に入れる (context/conventions.md)
      tabIndex={isTabStop ? 0 : -1}
    >
      <span className={clsx("flex h-4 items-center", startsWithTree && "mt-1")}>
        <LevelIcon level={entry.level} />
      </span>
      <span className="sr-only">{entry.level}</span>
      {/* 時刻は印の右の固定幅の列に置き、行をまたいで縦にそろえる。HH:MM:SS.mmm の 12 字が収まる幅にし、長い書式では列を広げる */}
      {entry.time !== undefined && (
        <span
          className={clsx(
            "flex h-4 min-w-22 shrink-0 items-center text-compact text-text tabular-nums",
            startsWithTree && "mt-1",
          )}
        >
          {entry.time}
        </span>
      )}
      {/* 狭い幅では、出力元を値の下へ折り返し、値の幅を空ける */}
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4">
        <div className="flex min-w-0 flex-1 basis-48 flex-wrap items-start gap-x-2 gap-y-1 font-mono text-compact text-text">
          {entry.args.map((arg, index) =>
            isExpandable(arg) ? (
              // oxlint-disable-next-line react/no-array-index-key -- 同じ値の引数が並ぶことがあり、並びも変わらない (context/conventions.md)
              <div className="w-full" key={index}>
                <TreeView
                  density="compact"
                  items={[toTreeNode(arg, `${entry.id}/${index}`)]}
                  isTabStop={false}
                  label="ログの値"
                  onEdge={handleEdge}
                />
              </div>
            ) : (
              // oxlint-disable-next-line react/no-array-index-key -- 同じ値の引数が並ぶことがあり、並びも変わらない (context/conventions.md)
              <span className="wrap-anywhere whitespace-pre-wrap" key={index}>
                {preview(arg)}
              </span>
            ),
          )}
        </div>
        <span
          className={clsx(
            "ml-auto flex h-4 shrink-0 items-center text-compact text-text",
            startsWithTree && "mt-1",
          )}
        >
          {entry.source}
        </span>
      </div>
    </li>
  );
}

/**
 * `console.*` の出力を、起きた順に並べたコンソール。行ごとに、ログレベルの印、時刻、値、出力元を出す。
 * 題の下のボタンで、表示するログレベルを選ぶ。配列、オブジェクト、`Error`、`Map`、`Set` は、TreeView で開いて中を見られる。
 * 高さは呼ぶ側が決める。高さを決めたときは、行の領域だけをスクロールさせる。
 * 行の領域だけをスクロールさせるときは、親を高さの決まった縦方向の flex か grid にする。
 * 高さを決めない親では、コンソールは行の数だけ伸び、行が増えてもページをスクロールしない。
 * 一番下を見ている間に行が増えると、行の領域を一番下まで送る。
 */
export function ConsoleEntryList({
  title = "コンソール",
  entries,
  defaultLevels = LEVELS,
  state,
}: ConsoleEntryListProps) {
  const [levels, setLevels] = useState<ReadonlySet<ConsoleLevel>>(() => new Set(defaultLevels));
  const visible: ConsoleEntry[] = [];
  const counts: Record<ConsoleLevel, number> = { debug: 0, log: 0, info: 0, warn: 0, error: 0 };
  for (const entry of entries) {
    counts[entry.level] += 1;
    if (levels.has(entry.level)) visible.push(entry);
  }
  const toggle = (level: ConsoleLevel) => {
    const next = new Set(levels);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    setLevels(next);
  };

  const lastId = visible.at(-1)?.id;
  // 行は 1 つだけを Tab のキーで止まる箇所にする。止まっていた行が上限かフィルタで消えたときは、一番新しい行にする
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  const tabStopId = visible.some((entry) => entry.id === focusedId) ? focusedId : lastId;
  const paneState: ToolPaneState =
    state ??
    (entries.length === 0
      ? { kind: "empty", message: "まだログがありません。" }
      : { kind: "ready" });

  // DevTools のコンソールと同じく、最初は一番下を見ている扱いにし、上へ戻したら送らない
  const rowsRef = useRef<HTMLElement>(null);
  const isAtBottom = useRef(true);
  const handleScroll = () => {
    const rows = rowsRef.current;
    if (!rows) return;
    isAtBottom.current = rows.scrollHeight - rows.scrollTop - rows.clientHeight < 2;
  };
  // 読み込み中、エラー、空の間は行の領域が消え、行の表示に戻ると先頭から描かれる。消えている間に一番下を見ている扱いに戻し、行の表示に戻ったときに一番下へ送る
  useEffect(() => {
    const rows = rowsRef.current;
    if (!rows) {
      isAtBottom.current = true;
      return;
    }
    if (isAtBottom.current) rows.scrollTop = rows.scrollHeight;
  }, [lastId, paneState.kind]);
  const toolbar = (
    <fieldset
      aria-label="表示するログレベル"
      className="flex min-w-0 flex-wrap border-b border-border px-2 py-1"
    >
      {LEVELS.map((level) => {
        const isOn = levels.has(level);
        return (
          <button
            aria-pressed={isOn}
            className={clsx(
              "flex min-h-7 cursor-pointer items-center gap-1.5 rounded-control px-2 text-label-compact ink-press transition-colors hover:bg-surface-subtle focus-visible:z-10 focus-visible:focus-ring",
              isOn ? "text-text" : "text-text-secondary",
            )}
            key={level}
            onClick={() => toggle(level)}
            type="button"
          >
            <CheckIcon isChecked={isOn} />
            {level}
            <span className="text-compact">
              {counts[level]}
              <span className="sr-only"> 件</span>
            </span>
          </button>
        );
      })}
    </fieldset>
  );
  return (
    <ToolPane state={paneState} title={title} toolbar={toolbar}>
      {/* 高さを呼ぶ側が決めたときは、題とボタンを残して、行の領域だけをスクロールさせる */}
      <div className="flex min-h-0 flex-1 flex-col">
        <section
          aria-label="ログの行"
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={handleScroll}
          ref={rowsRef}
        >
          {visible.length === 0 ? (
            <p className="p-3 text-body-compact text-text-secondary">
              選んだログレベルの行はありません。
            </p>
          ) : (
            <ol className="flex flex-col">
              {visible.map((entry) => (
                <EntryRow
                  entry={entry}
                  isTabStop={entry.id === tabStopId}
                  key={entry.id}
                  onFocusRow={setFocusedId}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </ToolPane>
  );
}
