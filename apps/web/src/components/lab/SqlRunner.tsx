import { useCallback, useId, useRef, useState } from "react";
import { dropRuntime, getRuntime, serialize, type RuntimeKind } from "./runtime";
import { cellText } from "./cell";
import { RAN_EVENT } from "./schema";
import { completeStep, loadProgress } from "./progress";
import SqlEditor from "./SqlEditor";

type Props = {
  contentId: string;
  /** 最初の h2 より前のパネルは -1。どの手順も完了にしない */
  stepIndex: number;
  stepCount: number;
  stepTitle: string;
  sql: string;
  setup?: string;
  /** 実行環境の表示名。Postgres 以外も載る */
  engine?: string;
  /** どの Worker を起こすか。frontmatter の runtime が決める */
  kind?: RuntimeKind;
  /** 全手順の SQL。再訪時に完了済みだけを順に流し直す */
  steps?: { step: number; sql: string }[];
};

type Phase = "idle" | "booting" | "waiting" | "running" | "done" | "failed";
type Result = {
  columns: string[];
  rows: unknown[][];
  total: number;
  affected: number;
  ms: number;
};


export default function SqlRunner({
  contentId,
  stepIndex,
  stepCount,
  stepTitle,
  sql,
  setup,
  engine = "実行環境",
  kind = "pglite",
  steps = [],
}: Props) {
  const [text, setText] = useState(sql);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const editorId = useId();
  const groupId = useId();
  const locked = useRef(false);

  const run = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    setMessage(null);
    setPhase("booting");
    try {
      // 完了済みを流し直す。全手順から選ぶので、どのパネルから起動しても同じ状態になる
      const saved = loadProgress(contentId, stepCount);
      const replay = [...steps]
        .sort((a, b) => a.step - b.step)
        .filter((p) => saved?.completedSteps.includes(p.step))
        .map((p) => p.sql);
      const rt = await getRuntime(contentId, kind, { setup, replay });
      setVersion(rt.version);
      // 前回の続きを再現できなかったことを黙って飲み込まない
      setStale(rt.replayFailed.length > 0);
      // 単一接続なので、他のパネルが走っていれば待つ
      setPhase("waiting");
      // 待ち時間を実行時間として出さないよう、Worker 側で測る
      const { results: all, ms } = await serialize(async () => {
        setPhase("running");
        return rt.exec(text);
      });
      // 前置きの insert や analyze ではなく、列を返した最後の文を出す
      const shown = [...all].reverse().find((r) => r.fields.length > 0) ?? all.at(-1);
      const rows = shown?.rows ?? [];
      setResult({
        columns: shown?.fields.map((f) => f.name) ?? [],
        rows,
        total: shown?.total ?? rows.length,
        affected: all.reduce((n, r) => n + r.affectedRows, 0),
        ms,
      });
      setPhase("done");
      if (stepIndex >= 0) completeStep(contentId, stepIndex, stepCount);
      // 側柱の一覧を引き直させる
      globalThis.dispatchEvent(new CustomEvent(RAN_EVENT, { detail: { contentId } }));
    } catch (e) {
      setResult(null);
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    } finally {
      locked.current = false;
    }
  }, [contentId, setup, stepCount, stepIndex, steps, text]);

  const reset = useCallback(() => {
    setText(sql);
    setResult(null);
    setMessage(null);
    setPhase("idle");
    setVersion(null);
    setStale(false);
    // 次の実行で setup が流し直される
    dropRuntime(contentId);
    globalThis.dispatchEvent(new CustomEvent(RAN_EVENT, { detail: { contentId } }));
  }, [contentId, sql]);

  /** Worker を落として止める。重いクエリでも即座に戻る */
  const cancel = useCallback(() => {
    dropRuntime(contentId);
    setVersion(null);
  }, [contentId]);

  const busy = phase === "booting" || phase === "waiting" || phase === "running";
  const label =
    phase === "booting"
      ? `${engine} を起動中…`
      : phase === "waiting"
        ? "順番待ち…"
        : phase === "running"
          ? "実行中…"
          : "実行";

  const status =
    phase === "booting"
      ? "初回は数十秒かかります"
      : phase === "failed"
        ? "失敗しました"
        : phase === "done" && result !== null
          ? result.columns.length > 0
            ? `${result.total} 行 · ${result.ms} ms`
            : `${result.affected} 行に影響 · ${result.ms} ms`
          : "";

  return (
    <section className="runner" data-phase={phase} aria-labelledby={groupId}>
      <div className="runner__bar mono meta">
        <span id={groupId}>{stepTitle}</span>
        {version !== null && (
          <span className="runner__engine" title="この端末のブラウザ内で動いています">
            {version}
          </span>
        )}
      </div>

      <SqlEditor
        id={editorId}
        label={`${stepTitle} の入力`}
        value={text}
        onChange={setText}
        onRun={() => void run()}
      />

      <div className="runner__bar">
        <button
          className="btn"
          type="button"
          onClick={run}
          aria-disabled={busy}
          data-busy={busy ? "true" : undefined}
        >
          {label}
        </button>
        {/* key を分けて DOM ノードを共有させない。
            同じノードだとラベルだけ入れ替わり、Enter の連打で初期化が走る */}
        {busy ? (
          <button key="cancel" className="btn" type="button" onClick={cancel}>
            中断
          </button>
        ) : (
          <button key="reset" className="btn" type="button" onClick={reset}>
            初めから
          </button>
        )}
        <p className="mono meta runner__count" role="status">
          {status}
        </p>
      </div>

      {stale && (
        <p className="runner__note mono meta">
          前回の続きを再現できなかった手順があります。「初めから」で作り直せます
        </p>
      )}
      {message !== null && <pre className="runner__error mono">{message}</pre>}

      {result !== null && result.columns.length > 0 && (
        <>
          <div className="runner__scroll">
            <table className="runner__table mono">
              <thead>
                <tr>
                  {result.columns.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, r) => (
                  <tr key={r}>
                    {result.columns.map((_, c) => (
                      <td key={c}>{cellText(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.total > result.rows.length && (
            <p className="mono meta runner__more">
              先頭 {result.rows.length} 行だけを出しています (全 {result.total} 行)
            </p>
          )}
        </>
      )}
    </section>
  );
}
