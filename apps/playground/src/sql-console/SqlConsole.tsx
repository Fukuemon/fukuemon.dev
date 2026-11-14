import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import { Button, EditorFrame, Loading, Notice } from "@fukuemon/ui";
import { type ReactNode, type Ref, useId, useState, useSyncExternalStore } from "react";

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
  /** 渡すと、入力欄を低くし、間隔と字を詰め、親の高さを埋めて結果の欄だけを送る。ほかのペインと並べて置くときに使う。 */
  dense?: boolean;
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
  runButtonRef,
  actions,
}: SqlConsoleProps) {
  const file = { id: fileName, label: fileName };
  const database = useSyncExternalStore(status.subscribe, status.getSnapshot);
  const hintId = useId();
  const [shown, setShown] = useState<{ id: number; response: SqlResponse }>();

  const run = async () => {
    if (running) return;
    const response = await onRun(value);
    setShown((previous) => ({ id: (previous?.id ?? 0) + 1, response }));
  };

  const density = dense ? "compact" : "default";
  const gap = dense ? "gap-2" : "gap-4";
  return (
    <DenseContext value={dense}>
      {/* 詰めた密度では、入力欄と操作を上に置いたまま、結果の領域だけを送る */}
      <div className={`flex min-w-0 flex-col ${gap} ${dense ? "h-full min-h-0" : ""}`}>
        <div
          className={`grid min-h-0 shrink-0 has-[.cm-focused]:focus-ring ${dense ? "h-40" : "h-96"}`}
        >
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
                value={value}
              />
            )}
          </EditorFrame>
        </div>
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
        <section
          aria-label="実行の結果"
          className={`flex min-w-0 flex-col ${gap} ${dense ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
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
      </div>
    </DenseContext>
  );
}
