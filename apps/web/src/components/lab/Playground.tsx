import { useId, useState } from "react";
import { usePreset } from "./bus";
import ResultTable from "./ResultTable";
import RunnerControls from "./RunnerControls";
import SqlEditor from "./SqlEditor";
import { useRunner } from "./useRunner";

type Props = {
  setup?: string;
  initial: string;
  engine?: string;
};

const KEY = "playground";

export default function Playground({ setup, initial, engine = "実行環境" }: Props) {
  const [text, setText] = useState(initial);
  const editorId = useId();
  const runner = useRunner({ key: KEY, setup });

  usePreset(KEY, setText);

  return (
    <div className="pg">
      <div
        className="runner my-intra-3 border border-rule-strong bg-code-bg"
        data-phase={runner.phase}
      >
        <div className="runner__bar mono meta flex items-center gap-intra-2 border-b border-rule-strong px-intra-3 py-[10px]">
          <span>SQL</span>
          {/* 起動した Postgres の版。実行が本物であることを示す */}
          {runner.version !== null && (
            <span className="runner__engine ms-auto text-fg-2">{runner.version}</span>
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
          // 遊び場では書いたものを消さない。実行環境だけ捨てる
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
