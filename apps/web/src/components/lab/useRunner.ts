import { useCallback, useRef, useState } from "react";
import { emitRan } from "./bus";
import { dropRuntime, getRuntime, serialize, type RuntimeKind } from "./runtime";

export type Phase = "idle" | "booting" | "waiting" | "running" | "done" | "failed";

export type Result = {
  columns: string[];
  rows: unknown[][];
  /** 上限で切る前の行数 */
  total: number;
  affected: number;
  ms: number;
};

type Options = {
  /** 実行環境の共有単位。同じ key のパネルは 1 インスタンスを共有する */
  key: string;
  kind?: RuntimeKind;
  setup?: string;
  /**
   * 起動時に流し直す入力。再訪で DB を復元する。
   * 「初めから」の直後は呼ばない — 決定的に失敗する手順があると、同じ所で落ち続けて
   * 復旧の道が閉じる。
   */
  replay?: () => string[];
  /** 実行が通ったあとに 1 度だけ呼ぶ。手順の完了記録に使う */
  onDone?: () => void;
};

export type Runner = {
  phase: Phase;
  result: Result | null;
  message: string | null;
  /** 起動した engine の版。実行が本物であることを画面で示す */
  version: string | null;
  /** 流し直しに失敗した手順がある。完了表示と DB がずれている */
  stale: boolean;
  busy: boolean;
  run: (source: string) => Promise<void>;
  /** 実行環境を捨てて初期状態へ戻す。入力欄は呼ぶ側の持ち物なので触らない */
  reset: () => void;
  /** Worker を落として止める。重いクエリでも即座に戻る */
  cancel: () => void;
};

/**
 * 実行パネルの状態機械。
 * ハンズオンの手順パネルと遊び場で同じ手順を踏むので、ここに 1 つだけ置く。
 */
export function useRunner({ key, kind = "pglite", setup, replay, onDone }: Options): Runner {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const locked = useRef(false);
  const fresh = useRef(false);
  // 呼ぶ側が毎レンダー作り直しても run を作り直さない
  const hooks = useRef({ replay, onDone });
  hooks.current = { replay, onDone };

  const run = useCallback(
    async (source: string) => {
      if (locked.current) return;
      locked.current = true;
      setMessage(null);
      setPhase("booting");
      try {
        const boot = fresh.current ? undefined : hooks.current.replay?.();
        fresh.current = false;
        const rt = await getRuntime(key, kind, { setup, replay: boot });
        setVersion(rt.version);
        // 前回の続きを再現できなかったことを黙って飲み込まない
        setStale(rt.replayFailed.length > 0);
        // 単一接続なので、他のパネルが走っていれば待つ
        setPhase("waiting");
        // 待ち時間を実行時間に混ぜないよう、Worker 側で測る
        const { results: all, ms } = await serialize(async () => {
          setPhase("running");
          return rt.exec(source);
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
        hooks.current.onDone?.();
        emitRan(key);
      } catch (e) {
        setResult(null);
        setMessage(e instanceof Error ? e.message : String(e));
        setPhase("failed");
      } finally {
        locked.current = false;
      }
    },
    [key, kind, setup],
  );

  const reset = useCallback(() => {
    setResult(null);
    setMessage(null);
    setPhase("idle");
    setVersion(null);
    setStale(false);
    // 次の実行は setup だけで起動する
    fresh.current = true;
    dropRuntime(key);
    emitRan(key);
  }, [key]);

  const cancel = useCallback(() => {
    dropRuntime(key);
    setVersion(null);
  }, [key]);

  const busy = phase === "booting" || phase === "waiting" || phase === "running";
  return { phase, result, message, version, stale, busy, run, reset, cancel };
}
