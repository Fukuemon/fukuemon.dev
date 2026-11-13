import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";

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
  /** 渡すと、一覧の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
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
      height="16"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 16 16"
      width="16"
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
      height="16"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 16 16"
      width="16"
    >
      <rect height="13" width="13" x="1.5" y="1.5" />
      {isChecked && <path d="M4.5 8l2.5 2.5 4.5-5" strokeWidth="2" />}
    </svg>
  );
}

function EntryRow({ entry }: { entry: ConsoleEntry }) {
  // ツリーの項目は文字の上に余白を持つので、値がツリーで始まる行は、印と時刻をその 1 行目にそろえる
  const startsWithTree = entry.args[0] !== undefined && isExpandable(entry.args[0]);
  return (
    <li
      className={clsx(
        "flex gap-2 border-b border-l-2 border-b-border py-2 pr-4 pl-3.5 last:border-b-0",
        ROW_CLASS_NAME[entry.level],
      )}
    >
      <span className={clsx("flex h-5 items-center", startsWithTree && "mt-3")}>
        <LevelIcon level={entry.level} />
      </span>
      <span className="sr-only">{entry.level}</span>
      {/* 狭い幅では、時刻と出力元を値の下へ折り返し、値の幅を空ける */}
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4">
        <div className="flex min-w-0 flex-1 basis-48 flex-wrap items-start gap-x-2 gap-y-2 font-mono text-body-dense text-text">
          {entry.args.map((arg, index) =>
            isExpandable(arg) ? (
              <div className="w-full" key={index}>
                <TreeView items={[toTreeNode(arg, `${entry.id}/${index}`)]} label="ログの値" />
              </div>
            ) : (
              <span className="wrap-anywhere whitespace-pre-wrap" key={index}>
                {preview(arg)}
              </span>
            ),
          )}
        </div>
        <span
          className={clsx(
            "ml-auto flex h-5 shrink-0 items-center gap-2 text-caption text-text",
            startsWithTree && "mt-3",
          )}
        >
          {entry.time !== undefined && <span>{entry.time}</span>}
          <span>{entry.source}</span>
        </span>
      </div>
    </li>
  );
}

/**
 * `console.*` の出力を、起きた順に並べたコンソール。行ごとに、ログレベルの印、値、時刻、出力元を出す。
 * 題の下のボタンで、表示するログレベルを選ぶ。配列、オブジェクト、`Error`、`Map`、`Set` は、TreeView で開いて中を見られる。
 * 高さは呼ぶ側が決める。高さを決めたときは、行の領域だけをスクロールさせる。親は、高さの決まった縦方向の flex か grid にする。
 * 高さを決めない親では、行の数だけ伸び、ページはスクロールしない。
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
  const paneState: ToolPaneState =
    state ??
    (entries.length === 0
      ? { kind: "empty", message: "まだログがありません。" }
      : { kind: "ready" });

  // DevTools のコンソールと同じく、最初は一番下を見ている扱いにし、上へ戻したら送らない
  const rowsRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const handleScroll = () => {
    const rows = rowsRef.current;
    if (!rows) return;
    isAtBottom.current = rows.scrollHeight - rows.scrollTop - rows.clientHeight < 2;
  };
  // 読み込み中とエラーの間は行の領域が消え、作り直すと先頭に戻る。一番下を見ている扱いに戻し、戻ったときは一番下へ送る
  useEffect(() => {
    const rows = rowsRef.current;
    if (!rows) {
      isAtBottom.current = true;
      return;
    }
    if (isAtBottom.current) rows.scrollTop = rows.scrollHeight;
  }, [lastId, paneState.kind]);
  const toolbar = (
    <div
      aria-label="表示するログレベル"
      className="flex flex-wrap border-b border-border px-1"
      role="group"
    >
      {LEVELS.map((level) => {
        const isOn = levels.has(level);
        return (
          <button
            aria-pressed={isOn}
            className={clsx(
              "relative flex min-h-11 cursor-pointer items-center gap-2 px-3 text-label transition-colors hover:bg-surface-subtle focus-visible:z-10 focus-visible:focus-ring",
              isOn ? "text-text" : "text-text-secondary",
            )}
            key={level}
            onClick={() => toggle(level)}
            type="button"
          >
            <CheckIcon isChecked={isOn} />
            {level}
            <span className="text-caption">
              {counts[level]}
              <span className="sr-only"> 件</span>
            </span>
          </button>
        );
      })}
    </div>
  );
  return (
    <ToolPane state={paneState} title={title} toolbar={toolbar}>
      {/* 高さを呼ぶ側が決めたときは、題とボタンを残して、行の領域だけをスクロールさせる */}
      <div
        aria-label="ログの行"
        className="min-h-0 flex-1 overflow-y-auto focus-visible:focus-ring"
        onScroll={handleScroll}
        ref={rowsRef}
        role="region"
        tabIndex={0}
      >
        {visible.length === 0 ? (
          <p className="p-4 text-body-dense text-text-secondary">
            選んだログレベルの行はありません。
          </p>
        ) : (
          <ol className="flex flex-col">
            {visible.map((entry) => (
              <EntryRow entry={entry} key={entry.id} />
            ))}
          </ol>
        )}
      </div>
    </ToolPane>
  );
}
