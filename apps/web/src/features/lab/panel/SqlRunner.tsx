import { useCallback, useId, useMemo, useState } from "react";
import type { RuntimeKind } from "../runtime/runtime";
import { readBootSpec } from "../steps/bootSpec";
import { completeStep, loadProgress } from "../steps/progress";
import ResultTable from "./ResultTable";
import RunnerControls from "./RunnerControls";
import SqlEditor from "../editor/SqlEditor";
import { useRunner } from "../runtime/useRunner";

type Props = {
  contentId: string;
  /** 最初の h2 より前のパネルは -1。どの手順も完了にしない */
  stepIndex: number;
  stepCount: number;
  stepTitle: string;
  sql: string;
  engine?: string;
  kind?: RuntimeKind;
};

export default function SqlRunner({
  contentId,
  stepIndex,
  stepCount,
  stepTitle,
  sql,
  engine = "実行環境",
  kind = "pglite",
}: Props) {
  const [text, setText] = useState(sql);
  const { setup, steps } = useMemo(() => readBootSpec(contentId), [contentId]);
  const editorId = useId();
  const groupId = useId();

  const replay = useCallback(() => {
    const saved = loadProgress(contentId, stepCount);
    return [...steps]
      .sort((a, b) => a.step - b.step)
      .filter((p) => saved?.completedSteps.includes(p.step))
      .map((p) => p.sql);
  }, [contentId, stepCount, steps]);

  const onDone = useCallback(() => {
    if (stepIndex >= 0) completeStep(contentId, stepIndex, stepCount);
  }, [contentId, stepIndex, stepCount]);

  const runner = useRunner({ key: contentId, kind, setup, replay, onDone });

  return (
    <section
      className="runner my-intra-3 border border-rule-strong bg-code-bg"
      data-phase={runner.phase}
      aria-labelledby={groupId}
    >
      <div className="runner__bar mono meta flex items-center gap-intra-2 border-b border-rule-strong px-intra-3 py-[10px]">
        <span id={groupId}>{stepTitle}</span>
        {runner.version !== null && (
          <span
            className="runner__engine ms-auto text-fg-2"
            title="この端末のブラウザ内で動いています"
          >
            {runner.version}
          </span>
        )}
      </div>

      <SqlEditor
        id={editorId}
        label={`${stepTitle} の入力`}
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
        onReset={() => {
          setText(sql);
          runner.reset();
        }}
      />

      {runner.stale && (
        <p className="runner__note mono meta border-t border-rule px-intra-3 py-intra-2 text-now">
          前回の続きを再現できなかった手順があります。「初めから」で作り直せます
        </p>
      )}
      {runner.message !== null && (
        <pre className="runner__error mono m-0 border-t border-rust bg-tint-rust p-intra-3 text-[0.85rem] whitespace-pre-wrap">
          {runner.message}
        </pre>
      )}
      {runner.result !== null && <ResultTable result={runner.result} />}
    </section>
  );
}
