import { useId, useState } from "react";
import { usePreset } from "../bus";
import ResultTable from "./ResultTable";
import RunnerControls from "./RunnerControls";
import SqlEditor from "../editor/SqlEditor";
import { useRunner } from "../runtime/useRunner";

type Props = {
  setup?: string;
  initial: string;
  engine?: string;
};

const KEY = "playground";

/** 例を選んだ後、入力欄が画面から外れていれば中央へ送る。結果を読み進めた後に選ぶと、入力欄は上へ流れている */
function reveal(el: HTMLElement | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= globalThis.innerHeight) return;
  el.scrollIntoView({ block: "center" });
}

export default function Playground({ setup, initial, engine = "実行環境" }: Props) {
  const [text, setText] = useState(initial);
  const editorId = useId();
  const runner = useRunner({ key: KEY, setup });

  usePreset(KEY, (sql) => {
    setText(sql);
    reveal(document.getElementById(editorId));
  });

  return (
    <div className="pg">
      <div
        className="runner my-intra-3 border border-rule-strong bg-code-bg"
        data-phase={runner.phase}
      >
        <div className="runner__bar meta flex items-center gap-intra-2 border-b border-rule-strong px-intra-3 py-intra-1 max-narrow:px-intra-2">
          <span>SQL</span>
          {runner.version !== null && (
            <span
              className="runner__engine mono ms-auto min-w-0 truncate text-fg-2"
              title={runner.version}
            >
              {runner.version}
            </span>
          )}
        </div>

        <SqlEditor
          id={editorId}
          label="試す SQL"
          value={text}
          onChange={setText}
          onRun={() => void runner.run(text)}
        />

        <RunnerControls
          phase={runner.phase}
          busy={runner.busy}
          result={runner.result}
          engine={engine}
          onRun={() => void runner.run(text)}
          onCancel={runner.cancel}
          onReset={runner.reset}
        />

        {runner.message !== null && (
          <pre className="runner__error mono m-0 border-t border-rust bg-tint-rust p-intra-3 text-[0.85rem] whitespace-pre-wrap">
            {runner.message}
          </pre>
        )}
        {runner.result !== null && <ResultTable result={runner.result} />}
      </div>
    </div>
  );
}
