import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import { Button, EditorFrame, Loading, Notice } from "@fukuemon/ui";
import { useId, useState, useSyncExternalStore } from "react";

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
  /** 入力欄のタブに出すファイルの名前。 */
  fileName: string;
  /** 渡すと、結果の欄に、SQL の実行を待っていることを出す。PGlite の読み込みと初期データの投入の待ちは、呼ぶ側が画面全体に出す。 */
  progress?: string;
  /** 渡すと、入力欄を低くし、間隔を詰める。ほかのペインと並べて置くときに使う。 */
  dense?: boolean;
};

/** SQL の入力欄、実行のボタン、結果の表と実行計画。 */
export function SqlConsole({
  value,
  onChange,
  onRun,
  running,
  status,
  stoppedHint,
  fileName,
  progress,
  dense = false,
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
          className={`grid min-h-0 shrink-0 has-[.cm-focused]:focus-ring ${dense ? "h-72" : "h-96"}`}
        >
          <EditorFrame files={[file]} onSelect={() => {}} selectedId={file.id} title="SQL">
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
          <Button isLoading={running} onClick={() => void run()} size={dense ? "XS" : "S"}>
            実行する
          </Button>
          <span className="text-caption text-text-secondary" id={hintId}>
            Ctrl か ⌘ と Enter でも実行します。Tab でインデントし、Esc の後の Tab
            でエディタの外へ移ります
          </span>
        </div>
        <section
          aria-label="実行の結果"
          className={`flex min-w-0 flex-col ${gap} ${dense ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
        >
          {progress !== undefined && <Loading density={density} label={progress} />}
          {database.kind === "stopped" && (
            <Notice density={density} isAlert title="DB が止まりました" tone="danger">
              {database.reason}。{stoppedHint}
            </Notice>
          )}
          {shown && <ResultView key={shown.id} response={shown.response} />}
        </section>
      </div>
    </DenseContext>
  );
}
