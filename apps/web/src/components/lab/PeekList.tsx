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
    <section className="peek border-t border-rule-strong pt-inter-1" aria-label="いまのテーブル">
      <button
        type="button"
        className="hit group mono meta flex w-full cursor-pointer items-center gap-intra-2 border-b border-rule-strong bg-transparent py-intra-1 text-start text-fg-2 [font:inherit]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {/* 開: 下向き / 閉: 右向き */}
        <span
          aria-hidden="true"
          className="h-0 w-0 flex-none border-x-4 border-t-5 border-x-transparent border-t-current group-aria-[expanded=false]:border-t-4 group-aria-[expanded=false]:border-b-4 group-aria-[expanded=false]:border-s-5 group-aria-[expanded=false]:border-e-0 group-aria-[expanded=false]:border-t-transparent group-aria-[expanded=false]:border-b-transparent group-aria-[expanded=false]:border-s-current"
        />
        いまのテーブル
        <span className="mono meta ms-auto">{tables.length}</span>
      </button>
      {open && (
        <>
          {tables.length === 0 && <p className="mono meta mt-intra-2 mb-0">まだありません</p>}
          {tables.length > 0 && (
            <button type="button" className="btn w-full my-intra-2" onClick={onShowEr}>
              テーブル構成
            </button>
          )}
          <ul className="m-0 list-none p-0">
            {tables.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  className="hit flex w-full cursor-pointer items-baseline justify-between gap-intra-2 border-t border-rule bg-transparent py-intra-1 text-start text-fg [font:inherit]"
                  onClick={() => onShowTable(t)}
                >
                  <span className="mono text-[0.8125rem]">{t.name}</span>
                  <span className="mono meta">{rowLabel(t.rows)}</span>
                </button>
                {relations
                  .filter((r) => r.src === t.name)
                  .map((r) => (
                    <p
                      key={r.name}
                      className="mono meta pb-intra-1 ps-intra-3 text-[0.75rem] text-fg-2"
                    >
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
