import { useCallback, useEffect, useId, useRef, useState } from "react";
import { dropRuntime, getRuntime, peekRuntime, serialize } from "./runtime";
import { cellText } from "./cell";
import { TABLES_SQL, type Table } from "./schema";
import SqlEditor from "./SqlEditor";

type Preset = { label: string; sql: string };

type Props = {
  /** 最初に 1 度だけ流す初期化。無い遊び場もある */
  setup?: string;
  presets: Preset[];
  engine?: string;
};

type Phase = "idle" | "booting" | "waiting" | "running" | "done" | "failed";
type Result = { columns: string[]; rows: unknown[][]; total: number; affected: number; ms: number };

const KEY = "playground";

export default function Playground({ setup, presets, engine = "実行環境" }: Props) {
  const [text, setText] = useState(presets[0]?.sql ?? "select version();");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const editorId = useId();
  const locked = useRef(false);

  const loadSchema = useCallback(async () => {
    try {
      const rt = peekRuntime(KEY);
      if (!rt) return;
      const { results } = await serialize(() => rt.exec(TABLES_SQL));
      const rows = results.at(-1)?.rows ?? [];
      setTables(
        rows.map((r) => ({ name: cellText(r[0] ?? ""), rows: Number(r[1] ?? 0) })),
      );
    } catch {
      // 一覧が出せなくても実行はできる
    }
  }, [setup]);

  const run = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    setMessage(null);
    setPhase("booting");
    try {
      const rt = await getRuntime(KEY, "pglite", { setup });
      setVersion(rt.version);
      setPhase("waiting");
      const { results: all, ms } = await serialize(async () => {
        setPhase("running");
        return rt.exec(text);
      });
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
      void loadSchema();
    } catch (e) {
      setResult(null);
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    } finally {
      locked.current = false;
    }
  }, [loadSchema, setup, text]);

  useEffect(() => {
    // 開いただけでは何も落とさない。起動は押されてから
    return () => dropRuntime(KEY);
  }, []);

  const busy = phase === "booting" || phase === "waiting" || phase === "running";
  const label =
    phase === "booting"
      ? `${engine} を起動中…`
      : phase === "waiting"
        ? "順番待ち…"
        : phase === "running"
          ? "実行中…"
          : "実行";

  return (
    <div className="playground">
      <div className="runner" data-phase={phase}>
        <div className="runner__bar mono meta">
          <span>SQL</span>
          {version !== null && <span className="runner__engine">{version}</span>}
        </div>

        <SqlEditor
          id={editorId}
          label="試す SQL"
          value={text}
          onChange={setText}
          onRun={() => void run()}
        />

        <div className="runner__bar">
          <button className="btn" type="button" onClick={run} disabled={busy}>
            {label}
          </button>
          {busy ? (
            <button key="cancel" className="btn" type="button" onClick={() => dropRuntime(KEY)}>
              中断
            </button>
          ) : (
            <button
              key="reset"
              className="btn"
              type="button"
              onClick={() => {
                dropRuntime(KEY);
                setTables([]);
                setResult(null);
                setMessage(null);
                setPhase("idle");
                setVersion(null);
              }}
            >
              初めから
            </button>
          )}
          <p className="mono meta runner__count" role="status">
            {phase === "booting"
              ? "初回は数十秒かかります"
              : phase === "failed"
                ? "失敗しました"
                : phase === "done" && result !== null
                  ? result.columns.length > 0
                    ? `${result.total} 行 · ${result.ms} ms`
                    : `${result.affected} 行に影響 · ${result.ms} ms`
                  : ""}
          </p>
        </div>

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
      </div>

      <div className="pg-aside">
        <section>
          <h2 className="mono meta pg-aside__head">試す</h2>
          <ul className="pg-list">
            {presets.map((p) => (
              <li key={p.label}>
                <button className="pg-preset" type="button" onClick={() => setText(p.sql)}>
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mono meta pg-aside__head">いま入っているもの</h2>
          {tables.length === 0 ? (
            <p className="mono meta pg-empty">実行すると出ます</p>
          ) : (
            <ul className="pg-list">
              {tables.map((t) => (
                <li key={t.name} className="pg-table">
                  <span className="mono pg-table__name">{t.name}</span>
                  <span className="mono meta pg-table__rows">
                    {t.rows > 0 ? `約 ${t.rows.toLocaleString("ja-JP")} 行` : "0 行"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
