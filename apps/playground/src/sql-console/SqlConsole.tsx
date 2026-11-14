import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import { Button, EditorFrame, Loading, Notice, PaneTabs } from "@fukuemon/ui";
import { type ReactNode, type Ref, useId, useState, useSyncExternalStore } from "react";

import { EDITOR_ICON, RESULT_ICON } from "../layout/icons";
import { useLayoutMode } from "../layout/useLayoutMode";
import type { EditorStates } from "../code-editor/editor-states";
import { usePaneFocus } from "../layout/usePaneFocus";
import { DenseContext } from "./density";
import { ResultView } from "./ResultView";
import { SqlEditor } from "./SqlEditor";

export type SqlConsoleProps = {
  /** 入力欄の SQL。値を持ち、保存するのは呼ぶ側である。 */
  value: string;
  onChange: (value: string) => void;
  /** 入力欄の SQL を実行する。結果は、このコンポーネントが表に出す。 */
  onRun: (sql: string) => Promise<SqlResponse>;
  running: boolean;
  status: Store<DatabaseStatus>;
  /** DB が止まったときに、止まった理由の後に出す、復帰の案内。 */
  stoppedHint?: string;
  /** 渡すと、DB が止まったときに、エラーの隣に「起動し直す」のボタンを出し、押すと呼ぶ。 */
  onRestart?: () => void;
  /** true のときは、「起動し直す」のボタンを待ちの表示にし、押せなくする。 */
  restarting?: boolean;
  /** 実行のボタンの文。ほかの「実行する」のボタンと同じページに置くときに替える。 */
  runLabel?: string;
  /** 実行のボタンの見た目。同じ画面にほかの主のボタンがあるときは secondary にする（PRIMARY-ACTION-ONE）。 */
  runVariant?: "primary" | "secondary";
  /** 入力欄のタブに出すファイルの名前。 */
  fileName: string;
  /** 渡すと、結果の欄に、SQL の実行を待っていることを出す。PGlite の読み込みと初期データの投入の待ちは、呼ぶ側が画面全体に出す。 */
  progress?: string;
  /**
   * 渡すと、入力欄を低くし、間隔と字を詰め、親の高さを埋めて結果の欄だけを送る。ほかのペインと並べて置くときに使う。
   * 配置は呼ぶ側のペインが決めるので、狭い配置でも入力と結果のタブに分けない。
   */
  dense?: boolean;
  /** 記事に埋め込んだときは、狭い配置のタブを枠の上に置く。 */
  embedded?: boolean;
  /** 実行のボタンへの ref。呼ぶ側が、操作の後にフォーカスをボタンへ移すために使う。 */
  runButtonRef?: Ref<HTMLButtonElement>;
  /** 実行のボタンの行の右端に置くもの。出入りしても、入力欄の位置が動かないようにするため、行は常にある。 */
  actions?: ReactNode;
};

/** SQL の入力欄、実行のボタン、結果の表と実行計画。 */
export function SqlConsole({
  value,
  onChange,
  onRun,
  running,
  status,
  stoppedHint,
  onRestart,
  restarting = false,
  runLabel = "実行する",
  runVariant = "primary",
  fileName,
  progress,
  dense = false,
  embedded = false,
  runButtonRef,
  actions,
}: SqlConsoleProps) {
  const file = { id: fileName, label: fileName };
  const database = useSyncExternalStore(status.subscribe, status.getSnapshot);
  const hintId = useId();
  const [shown, setShown] = useState<{ id: number; response: SqlResponse }>();
  const mode = useLayoutMode();
  const [pane, setPane] = useState<"input" | "result">("input");
  const { rootRef, focusSelectedTab } = usePaneFocus();
  // 配置が替わって入力欄を作り直しても、元に戻す履歴とカーソルを残す
  const [editorStates] = useState<EditorStates>(() => new Map());

  const run = async () => {
    if (running) return;
    const response = await onRun(value);
    setShown((previous) => ({ id: (previous?.id ?? 0) + 1, response }));
    setPane("result");
    focusSelectedTab();
  };

  const density = dense ? "compact" : "default";
  const gap = dense ? "gap-2" : "gap-4";
  const editor = (
    <EditorFrame
      files={[file]}
      minBodyHeight={dense ? "none" : "default"}
      onSelect={() => {}}
      selectedId={file.id}
      title="SQL"
    >
      {() => (
        <SqlEditor
          describedBy={hintId}
          onChange={onChange}
          onRun={() => void run()}
          states={editorStates}
          value={value}
        />
      )}
    </EditorFrame>
  );
  const runRow = (
    <div className={`flex shrink-0 flex-wrap items-center ${gap}`}>
      <Button
        isLoading={running}
        onClick={() => void run()}
        ref={runButtonRef}
        size={dense ? "XS" : "S"}
        variant={runVariant}
      >
        {runLabel}
      </Button>
      <span
        className={`${dense ? "text-compact" : "text-caption"} text-text-secondary`}
        id={hintId}
      >
        Ctrl か ⌘ と Enter でも実行します。Tab でインデントし、Esc の後の Tab
        でエディタの外へ移ります
      </span>
      {actions}
    </div>
  );
  const results = (
    <section
      aria-label="実行の結果"
      className={`flex min-w-0 flex-col ${gap} ${dense ? "min-h-0 flex-1 overflow-y-auto scroll-fade-pane" : ""}`}
    >
      {progress !== undefined && <Loading density={density} label={progress} />}
      {database.kind === "stopped" && (
        <Notice density={density} isAlert title="DB が止まりました" tone="danger">
          {database.reason}。{stoppedHint}
          {onRestart && (
            <span className="mt-2 block">
              <Button
                disabled={restarting}
                isLoading={restarting}
                onClick={onRestart}
                size={dense ? "XS" : "S"}
                variant="secondary"
              >
                起動し直す
              </Button>
            </span>
          )}
        </Notice>
      )}
      {shown && <ResultView key={shown.id} response={shown.response} />}
    </section>
  );

  if (dense) {
    return (
      <DenseContext value>
        {/* 入力欄と操作を上に置いたまま、結果の領域だけを送る。面はペインの紙の面にする（docs/adr/0073-layered-panes-and-radius-in-playground.md） */}
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-pane bg-surface-pane p-2">
          <div className="grid h-40 min-h-0 shrink-0 has-[.cm-focused]:focus-ring">{editor}</div>
          {runRow}
          {results}
        </div>
      </DenseContext>
    );
  }
  if (mode === "wide") {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid h-96 min-h-0 has-[.cm-focused]:focus-ring">{editor}</div>
        {runRow}
        {/* 結果は、出すものがあるときだけ、地の上の紙の面に置く（docs/adr/0073-layered-panes-and-radius-in-playground.md） */}
        {(progress !== undefined || database.kind === "stopped" || shown !== undefined) && (
          <div className="min-w-0 rounded-pane bg-surface-pane p-3">{results}</div>
        )}
      </div>
    );
  }
  return (
    <div className="min-h-0 min-w-0 flex-1" ref={rootRef}>
      <PaneTabs
        items={[
          {
            id: "input",
            label: "入力",
            icon: EDITOR_ICON,
            content: (
              <div
                className={
                  embedded
                    ? "flex min-h-0 flex-1 flex-col gap-3 bg-surface-pane p-2"
                    : "flex min-h-0 flex-1 flex-col gap-3 rounded-pane bg-surface-pane p-2"
                }
              >
                <div className="grid min-h-0 flex-1 has-[.cm-focused]:focus-ring">{editor}</div>
                {runRow}
              </div>
            ),
          },
          {
            id: "result",
            label: "結果",
            icon: RESULT_ICON,
            content: (
              <div
                className={
                  embedded
                    ? "min-h-0 flex-1 overflow-auto bg-surface-pane p-2 scroll-fade-pane"
                    : "min-h-0 flex-1 overflow-auto rounded-pane bg-surface-pane p-2 scroll-fade-pane"
                }
              >
                {results}
              </div>
            ),
          },
        ]}
        label="ペイン"
        onSelect={(id) => setPane(id === "result" ? "result" : "input")}
        flush={embedded}
        placement={mode === "short" ? "start" : embedded ? "top" : "bottom"}
        selectedId={pane}
      />
    </div>
  );
}
