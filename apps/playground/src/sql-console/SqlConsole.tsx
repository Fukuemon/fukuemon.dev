import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import { Button, EditorFrame, Loading, Notice } from "@fukuemon/ui";
import { type Ref, useId, useState, useSyncExternalStore } from "react";

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
  /** 実行のボタンへの ref。呼ぶ側が、操作の後にフォーカスをボタンへ移すために使う。 */
  runButtonRef?: Ref<HTMLButtonElement>;
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
  runButtonRef,
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid h-96 min-h-0 has-[.cm-focused]:focus-ring">
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
      <div className="flex flex-wrap items-center gap-4">
        <Button isLoading={running} onClick={() => void run()} ref={runButtonRef} size="S">
          実行する
        </Button>
        <span className="text-caption text-text-secondary" id={hintId}>
          Ctrl か ⌘ と Enter でも実行します。Tab でインデントし、Esc の後の Tab
          でエディタの外へ移ります
        </span>
      </div>
      <section aria-label="実行の結果" className="flex min-w-0 flex-col gap-4">
        {progress !== undefined && <Loading label={progress} />}
        {database.kind === "stopped" && (
          <Notice isAlert title="DB が止まりました" tone="danger">
            {database.reason}。{stoppedHint}
          </Notice>
        )}
        {shown && <ResultView key={shown.id} response={shown.response} />}
      </section>
    </div>
  );
}
