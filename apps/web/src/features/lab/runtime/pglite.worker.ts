/// <reference lib="webworker" />
import { PGlite } from "@electric-sql/pglite";

type Req =
  | { id: number; kind: "boot"; setup?: string; replay?: string[] }
  | { id: number; kind: "exec"; sql: string };

type Res =
  | { id: number; ok: true; kind: "boot"; version: string; replayFailed: number[] }
  | { id: number; ok: true; kind: "exec"; results: unknown; ms: number }
  | { id: number; ok: false; error: string };

let db: PGlite | undefined;

/** "PostgreSQL 18.3 (PGlite 0.5.8) on wasm32-..." から版と実行環境だけを取る */
function shorten(full: string): string {
  const ver = /PostgreSQL\s+([\d.]+)/.exec(full)?.[1];
  const arch = /\son\s+([^,\s]+)/.exec(full)?.[1];
  if (ver && arch) return `PostgreSQL ${ver} · ${arch}`;
  return ver ? `PostgreSQL ${ver}` : full.slice(0, 48);
}

/** 画面に出す上限。10 万行を渡すと要素 40 万・ページ高 380 万 px になる */
const MAX_ROWS = 200;

const post = (m: Res) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    if (req.kind === "boot") {
      db = await PGlite.create();
      if (req.setup) await db.exec(req.setup);
      const replayFailed: number[] = [];
      for (const [i, sql] of (req.replay ?? []).entries()) {
        try {
          await db.exec(sql);
        } catch {
          replayFailed.push(i);
        }
      }
      const res = await db.query<{ v: string }>("select version() as v");
      post({
        id: req.id,
        ok: true,
        kind: "boot",
        version: shorten(res.rows[0]?.v ?? ""),
        replayFailed,
      });
      return;
    }
    if (!db) throw new Error("起動していません");
    const t0 = performance.now();
    const results = await db.exec(req.sql, { rowMode: "array" });
    post({
      id: req.id,
      ok: true,
      kind: "exec",
      results: results.map((r) => ({
        fields: r.fields.map((f) => ({ name: f.name })),
        rows: r.rows.slice(0, MAX_ROWS),
        total: r.rows.length,
        affectedRows: r.affectedRows ?? 0,
      })),
      ms: Math.round(performance.now() - t0),
    });
  } catch (err) {
    post({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
