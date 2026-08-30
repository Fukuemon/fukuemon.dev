import type { Phase, Result } from "./useRunner";

type Props = {
  phase: Phase;
  busy: boolean;
  result: Result | null;
  /** 実行環境の表示名。Postgres 以外も載る */
  engine: string;
  onRun: () => void;
  onCancel: () => void;
  onReset: () => void;
};

/** 実行パネルの操作行。押せる状態と、直前の実行の結末を出す */
export default function RunnerControls({
  phase,
  busy,
  result,
  engine,
  onRun,
  onCancel,
  onReset,
}: Props) {
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
    <div className="runner__bar">
      {/* disabled にするとフォーカスが外れて、押した位置を見失う */}
      <button
        className="btn"
        type="button"
        onClick={onRun}
        aria-disabled={busy}
        data-busy={busy ? "true" : undefined}
      >
        {label}
      </button>
      {/* key を分けて DOM ノードを共有させない。
          同じノードだとラベルだけ入れ替わり、Enter の連打で初期化が走る */}
      {busy ? (
        <button key="cancel" className="btn" type="button" onClick={onCancel}>
          中断
        </button>
      ) : (
        <button key="reset" className="btn" type="button" onClick={onReset}>
          初めから
        </button>
      )}
      <p className="mono meta runner__count" role="status">
        {status}
      </p>
    </div>
  );
}
