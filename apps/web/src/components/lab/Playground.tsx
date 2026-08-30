import { useId, useState } from "react";
import { usePreset } from "./bus";
import ResultTable from "./ResultTable";
import RunnerControls from "./RunnerControls";
import SqlEditor from "./SqlEditor";
import { useRunner } from "./useRunner";

type Props = {
  /** 最初に 1 度だけ流す初期化。無い遊び場もある */
  setup?: string;
  /** 入力欄の初期値 */
  initial: string;
  engine?: string;
};

const KEY = "playground";

/** 手順に縛られず動かす場所。手順の記録を持たないぶん SqlRunner より薄い */
export default function Playground({ setup, initial, engine = "実行環境" }: Props) {
  const [text, setText] = useState(initial);
  const editorId = useId();
  const runner = useRunner({ key: KEY, setup });

  // 側柱の「試す」は別の島。事象で受ける
  usePreset(KEY, setText);

  return (
    <div className="pg">
      <div className="runner" data-phase={runner.phase}>
        <div className="runner__bar mono meta">
          <span>SQL</span>
          {runner.version !== null && <span className="runner__engine">{runner.version}</span>}
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

        {runner.message !== null && <pre className="runner__error mono">{runner.message}</pre>}
        {runner.result !== null && <ResultTable result={runner.result} />}
      </div>
    </div>
  );
}
