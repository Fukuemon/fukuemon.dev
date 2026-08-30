import { useCallback, useEffect, useRef, useState } from "react";
import { peekRuntime, serialize } from "./runtime";
import { cellText } from "./cell";
import {
  COLUMNS_SQL,
  RAN_EVENT,
  RELATIONS_SQL,
  TABLES_SQL,
  type Column,
  type RanEvent,
  type Relation,
  type Table,
} from "./schema";

type Props = { contentId: string };

const MAX_PEEK = 20;

type Detail = { columns: Column[]; head: string[]; rows: unknown[][] };

/**
 * いま DB に入っているテーブルを側柱に出す。
 * 自分からは起動せず、実行パネルが走ったあとのインスタンスへ相乗りする。
 * 中身は幅が要るので `<dialog>` に出す。
 */
export default function DbPeek({ contentId }: Props) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [shown, setShown] = useState(true);
  const [open, setOpen] = useState<Table | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    try {
      const rt = peekRuntime(contentId);
      if (!rt) return;
      const { results } = await serialize(() => rt.exec(TABLES_SQL));
      const found = results.at(-1)?.rows ?? [];
      setTables(found.map((r) => ({ name: cellText(r[0] ?? ""), rows: Number(r[1] ?? 0) })));

      const rel = await serialize(() => rt.exec(RELATIONS_SQL));
      setRelations(
        (rel.results.at(-1)?.rows ?? []).map((r) => ({
          name: cellText(r[0] ?? ""),
          src: cellText(r[1] ?? ""),
          tgt: cellText(r[2] ?? ""),
          def: cellText(r[3] ?? ""),
        })),
      );
    } catch {
      // 一覧が出せなくても本文は読める
    }
  }, [contentId]);

  useEffect(() => {
    const on = (e: Event) => {
      if ((e as RanEvent).detail.contentId === contentId) void load();
    };
    globalThis.addEventListener(RAN_EVENT, on);
    return () => globalThis.removeEventListener(RAN_EVENT, on);
  }, [contentId, load]);

  const show = useCallback(
    async (t: Table) => {
      setOpen(t);
      setDetail(null);
      dialog.current?.showModal();
      try {
        const rt = peekRuntime(contentId);
        if (!rt) return setDetail({ columns: [], head: [], rows: [] });
        // 識別子は pg_class 由来のみ。読者の入力は混ぜない
        const cols = await serialize(() => rt.exec(COLUMNS_SQL.replace("$1", literal(t.name))));
        const rows = await serialize(() =>
          rt.exec(`select * from ${quote(t.name)} limit ${MAX_PEEK}`),
        );
        const last = rows.results.at(-1);
        setDetail({
          columns: (cols.results.at(-1)?.rows ?? []).map((r) => ({
            name: cellText(r[0] ?? ""),
            type: cellText(r[1] ?? ""),
            nullable: r[2] === true,
            pk: r[3] === true,
          })),
          head: last?.fields.map((f) => f.name) ?? [],
          rows: last?.rows ?? [],
        });
      } catch {
        setDetail({ columns: [], head: [], rows: [] });
      }
    },
    [contentId],
  );

  if (tables === null) return null;

  return (
    <>
      <section className="peek" aria-label="いまのテーブル">
        <button
          type="button"
          className="hit peek__label mono meta"
          aria-expanded={shown}
          onClick={() => setShown((v) => !v)}
        >
          <span aria-hidden="true" className="peek__caret" />
          いまのテーブル
          <span className="mono meta peek__n">{tables.length}</span>
        </button>
        {shown && (
          <>
            {tables.length === 0 && <p className="mono meta peek__empty">まだありません</p>}
            <ul className="peek__list">
              {tables.map((t) => (
                <li key={t.name}>
                  <button type="button" className="hit peek__row" onClick={() => void show(t)}>
                    <span className="mono peek__name">{t.name}</span>
                    <span className="mono meta peek__rows">{rowLabel(t.rows)}</span>
                  </button>
                  {relations
                    .filter((r) => r.src === t.name)
                    .map((r) => (
                      <p key={r.name} className="mono meta peek__rel">
                        <span aria-hidden="true">└→</span> {r.tgt}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* top layer なので側柱の overflow に切られない */}
      <dialog ref={dialog} className="sheet" onClose={() => setOpen(null)}>
        <header className="sheet__head">
          <span className="mono sheet__name">{open?.name}</span>
          <span className="mono meta">{rowLabel(open?.rows ?? -1)}</span>
          <button type="button" className="btn sheet__close" onClick={() => dialog.current?.close()}>
            閉じる
          </button>
        </header>

        {detail === null ? (
          <p className="mono meta">読み込み中…</p>
        ) : (
          <div className="sheet__body">
            <section className="sheet__cols" aria-label="列">
              <p className="mono meta sheet__sub">列</p>
              <ul className="er">
                {detail.columns.map((c) => (
                  <li key={c.name} className="er__row">
                    <span className="mono er__key" aria-hidden="true">
                      {c.pk ? "PK" : ""}
                    </span>
                    <span className="mono er__name">{c.name}</span>
                    <span className="mono meta er__type">{c.type}</span>
                    <span className="mono meta er__null">{c.nullable ? "null 可" : "not null"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sheet__rows" aria-label="先頭の行">
              <p className="mono meta sheet__sub">先頭 {MAX_PEEK} 行</p>
              <div className="sheet__scroll">
                <table className="sheet__tbl">
                  <thead>
                    <tr>
                      {detail.head.map((c) => (
                        <th key={c} className="mono meta">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j} className="mono">
                            {cellText(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </dialog>
    </>
  );
}

/** `reltuples` は ANALYZE が入るまで -1。概算であることも明示する */
const rowLabel = (n: number) => (n < 0 ? "未計測" : `約 ${n.toLocaleString("ja-JP")} 行`);

/** 大文字や記号を含む名前のために識別子で包む */
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
/** `regclass` へ渡す文字列リテラル */
const literal = (v: string) => `'${v.replaceAll("'", "''")}'`;
