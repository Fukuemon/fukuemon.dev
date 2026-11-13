import { clsx } from "clsx";
import { type Ref, useEffect, useRef, useState } from "react";

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
  /**
   * 起きた順に並べた行。上限と古い行の扱いは、呼ぶ側が決める。
   * スクロールする枠も呼ぶ側が持つ。最後の行が見えている間に行が増えると、新しい最後の行が見える位置まで送る。
   */
  entries: readonly ConsoleEntry[];
  /** 最初に表示するログレベル。渡さないと、全てのログレベルを表示する。 */
  defaultLevels?: readonly ConsoleLevel[];
  /** 渡すと、一覧の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
};

const LEVELS: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

/** 読み上げる名前。印の形と行の色に、文字を重ねる。 */
const LEVEL_LABEL: Record<ConsoleLevel, string> = {
  debug: "デバッグ",
  log: "ログ",
  info: "情報",
  warn: "警告",
  error: "エラー",
};

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

/** ログレベルの印。色を見分けられなくても区別できるように、形を変える。 */
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
      {level === "debug" && <path d="M4 8h1M7.5 8h1M11 8h1" strokeWidth="2" />}
      {level === "log" && <path d="M5 4l4 4-4 4" />}
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

function EntryRow({ entry, ref }: { entry: ConsoleEntry; ref?: Ref<HTMLLIElement> }) {
  return (
    <li
      ref={ref}
      className={clsx(
        "flex gap-2 border-b border-l-2 border-b-border px-4 py-2",
        ROW_CLASS_NAME[entry.level],
      )}
    >
      <span className="flex h-6 items-center">
        <LevelIcon level={entry.level} />
      </span>
      <span className="sr-only">{LEVEL_LABEL[entry.level]}</span>
      {/* 狭い幅では、時刻と出力元を値の下へ折り返し、値の幅を空ける */}
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4">
        <div className="flex min-w-0 flex-1 basis-48 flex-wrap items-start gap-x-2 font-mono text-code text-text">
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
        <span className="ml-auto flex h-6 shrink-0 items-center gap-2 text-caption text-text">
          {entry.time !== undefined && <span>{entry.time}</span>}
          <span>{entry.source}</span>
        </span>
      </div>
    </li>
  );
}

/**
 * `console.*` の出力を、起きた順に並べたコンソール。行ごとに、ログレベルの印、値、出力元を出す。
 * 題の下のボタンで、表示するログレベルを選ぶ。配列、オブジェクト、`Error`、`Map`、`Set` は、TreeView で開いて中を見られる。
 */
export function ConsoleEntryList({
  title = "コンソール",
  entries,
  defaultLevels = LEVELS,
  state,
}: ConsoleEntryListProps) {
  const [levels, setLevels] = useState<ReadonlySet<ConsoleLevel>>(() => new Set(defaultLevels));
  const visible = entries.filter((entry) => levels.has(entry.level));
  const toggle = (level: ConsoleLevel) => {
    const next = new Set(levels);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    setLevels(next);
  };

  // スクロールする枠は呼ぶ側が持つので、枠を探さずに、最後の行が見えているかで一番下を見ているかを決める
  const lastRowRef = useRef<HTMLLIElement>(null);
  const isAtBottom = useRef(false);
  const lastId = visible.at(-1)?.id;
  useEffect(() => {
    const row = lastRowRef.current;
    if (!row) return;
    if (isAtBottom.current) row.scrollIntoView({ block: "nearest" });
    const observer = new IntersectionObserver(([observed]) => {
      isAtBottom.current = observed?.isIntersecting ?? false;
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [lastId]);

  const paneState: ToolPaneState =
    state ??
    (entries.length === 0
      ? { kind: "empty", message: "まだログがありません。" }
      : { kind: "ready" });
  const toolbar = (
    <div
      aria-label="表示するログレベル"
      className="flex flex-wrap border-b border-border"
      role="group"
    >
      {LEVELS.map((level) => {
        const isOn = levels.has(level);
        const count = entries.filter((entry) => entry.level === level).length;
        return (
          <button
            aria-pressed={isOn}
            className={clsx(
              "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-label transition-colors hover:bg-surface-subtle focus-visible:focus-ring",
              isOn ? "text-text" : "text-text-secondary",
            )}
            key={level}
            onClick={() => toggle(level)}
            type="button"
          >
            <CheckIcon isChecked={isOn} />
            {level}
            <span className="text-caption">{count}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <ToolPane state={paneState} title={title} toolbar={toolbar}>
      {visible.length === 0 ? (
        <p className="p-4 text-body-dense text-text-secondary">
          選んだログレベルの行はありません。
        </p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((entry) => (
            <EntryRow
              entry={entry}
              key={entry.id}
              ref={entry.id === lastId ? lastRowRef : undefined}
            />
          ))}
        </ol>
      )}
    </ToolPane>
  );
}
