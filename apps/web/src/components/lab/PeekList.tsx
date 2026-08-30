import type { Relation, Table } from "./catalog";

type Props = {
  tables: Table[];
  relations: Relation[];
  open: boolean;
  onToggle: () => void;
  onShowEr: () => void;
  onShowTable: (t: Table) => void;
};

/** `reltuples` は ANALYZE が入るまで -1。概算であることも明示する */
export const rowLabel = (n: number) => (n < 0 ? "未計測" : `約 ${n.toLocaleString("ja-JP")} 行`);

export default function PeekList({
  tables,
  relations,
  open,
  onToggle,
  onShowEr,
  onShowTable,
}: Props) {
  return (
    <section className="peek" aria-label="いまのテーブル">
      <button
        type="button"
        className="hit peek__label mono meta"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span aria-hidden="true" className="peek__caret" />
        いまのテーブル
        <span className="mono meta peek__n">{tables.length}</span>
      </button>
      {open && (
        <>
          {tables.length === 0 && <p className="mono meta peek__empty">まだありません</p>}
          {tables.length > 0 && (
            <button type="button" className="btn peek__er" onClick={onShowEr}>
              テーブル構成
            </button>
          )}
          <ul className="peek__list">
            {tables.map((t) => (
              <li key={t.name}>
                <button type="button" className="hit peek__row" onClick={() => onShowTable(t)}>
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
  );
}
