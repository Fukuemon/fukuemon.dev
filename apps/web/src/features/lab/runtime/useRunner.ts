import { useCallback, useRef, useState } from "react";
import { emitRan } from "../bus";
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

type ExecResult = {
  fields: { name: string }[];
  rows: unknown[][];
  total: number;
  affectedRows: number;
};

type Options = {
  key: string;
  kind?: RuntimeKind;
  setup?: string;
  replay?: () => string[];
  onDone?: () => void;
};

export type Runner = {
  phase: Phase;
  result: Result | null;
  message: string | null;
  version: string | null;
  /** 流し直しに失敗した手順がある。完了表示と DB がずれている */
  stale: boolean;
  busy: boolean;
  run: (source: string) => Promise<void>;
  reset: () => void;
  cancel: () => void;
};

/** 前置きの insert や analyze ではなく、列を返した最後の文を出す */
function summarize(all: ExecResult[], ms: number): Result {
  const shown = [...all].reverse().find((r) => r.fields.length > 0) ?? all.at(-1);
  const rows = shown?.rows ?? [];
  return {
    columns: shown?.fields.map((f) => f.name) ?? [],
    rows,
    total: shown?.total ?? rows.length,
    affected: all.reduce((n, r) => n + r.affectedRows, 0),
    ms,
  };
}

export function useRunner({ key, kind = "pglite", setup, replay, onDone }: Options): Runner {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const locked = useRef(false);
  /**
   * 「初めから」の直後は流し直しを飛ばす。
   * 完了済みの手順が決定的に失敗する場合、同じ replay を組み直すと同じ所で落ち、
   * 案内した復旧の道が閉じる。
   */
  const skipReplay = useRef(false);
  const hooks = useRef({ replay, onDone });
  hooks.current = { replay, onDone };

  const run = useCallback(
    async (source: string) => {
      if (locked.current) return;
      locked.current = true;
      setMessage(null);
      setPhase("booting");
      try {
        const boot = skipReplay.current ? undefined : hooks.current.replay?.();
        skipReplay.current = false;
        const rt = await getRuntime(key, kind, { setup, replay: boot });
        setVersion(rt.version);
        setStale(rt.replayFailed.length > 0);
        setPhase("waiting");
        const { results, ms } = await serialize(async () => {
          setPhase("running");
          return rt.exec(source);
        });
        setResult(summarize(results, ms));
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

  /** 実行環境を捨てて初期状態へ戻す。入力欄は呼ぶ側の持ち物なので触らない */
  const reset = useCallback(() => {
    setResult(null);
    setMessage(null);
    setPhase("idle");
    setVersion(null);
    setStale(false);
    skipReplay.current = true;
    dropRuntime(key);
    emitRan(key);
  }, [key]);

  /** Worker を落として止める。重いクエリでも即座に戻る */
  const cancel = useCallback(() => {
    dropRuntime(key);
    setVersion(null);
  }, [key]);

  const busy = phase === "booting" || phase === "waiting" || phase === "running";
  return { phase, result, message, version, stale, busy, run, reset, cancel };
}
