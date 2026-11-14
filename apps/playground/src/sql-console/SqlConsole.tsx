import type { DatabaseStatus, SqlResponse, Store } from "@fukuemon/sql-runtime";
import { Button, EditorFrame, Loading, Notice, PaneTabs } from "@fukuemon/ui";
import { useId, useState, useSyncExternalStore } from "react";

import { EDITOR_ICON, RESULT_ICON } from "../layout/icons";
import { useLayoutMode } from "../layout/useLayoutMode";
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
  /** 記事に埋め込んだときは、狭い配置のタブを枠の上に置く。 */
  embedded?: boolean;
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
  embedded = false,
}: SqlConsoleProps) {
  const file = { id: fileName, label: fileName };
  const database = useSyncExternalStore(status.subscribe, status.getSnapshot);
  const hintId = useId();
  const [shown, setShown] = useState<{ id: number; response: SqlResponse }>();
  const mode = useLayoutMode();
  const [pane, setPane] = useState<"input" | "result">("input");

  const run = async () => {
    if (running) return;
    const response = await onRun(value);
    setShown((previous) => ({ id: (previous?.id ?? 0) + 1, response }));
    setPane("result");
  };

  const editor = (
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
  );
  const runRow = (
    <div className="flex flex-wrap items-center gap-4">
      <Button isLoading={running} onClick={() => void run()} size="S">
        実行する
      </Button>
      <span className="text-caption text-text-secondary" id={hintId}>
        Ctrl か ⌘ と Enter でも実行します。Tab でインデントし、Esc の後の Tab
        でエディタの外へ移ります
      </span>
    </div>
  );
  const results = (
    <section aria-label="実行の結果" className="flex min-w-0 flex-col gap-4">
      {progress !== undefined && <Loading label={progress} />}
      {database.kind === "stopped" && (
        <Notice isAlert title="DB が止まりました" tone="danger">
          {database.reason}。{stoppedHint}
        </Notice>
      )}
      {shown && <ResultView key={shown.id} response={shown.response} />}
    </section>
  );

  if (mode === "wide") {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid h-96 min-h-0 has-[.cm-focused]:focus-ring">{editor}</div>
        {runRow}
        {results}
      </div>
    );
  }
  return (
    <div className="min-h-0 min-w-0 flex-1">
      <PaneTabs
        items={[
          {
            id: "input",
            label: "入力",
            icon: EDITOR_ICON,
            content: (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-2">
                <div className="grid min-h-0 flex-1 has-[.cm-focused]:focus-ring">{editor}</div>
                {runRow}
              </div>
            ),
          },
          {
            id: "result",
            label: "結果",
            icon: RESULT_ICON,
            content: <div className="min-h-0 flex-1 overflow-auto p-2">{results}</div>,
          },
        ]}
        label="ペイン"
        onSelect={(id) => setPane(id === "result" ? "result" : "input")}
        placement={mode === "short" ? "start" : embedded ? "top" : "bottom"}
        selectedId={pane}
      />
    </div>
  );
}
