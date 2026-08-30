import { cellText } from "./cell";
import type { Column } from "./catalog";

export type Detail = { columns: Column[]; head: string[]; rows: unknown[][] };

export default function TableDetail({ detail, limit }: { detail: Detail; limit: number }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      {/* 列が多いテーブルでは、行の一覧が潰れないよう列の側を先に縮める */}
      <section
        className="min-h-0 flex-initial overflow-y-auto py-intra-2 leading-[1.6] text-fg-2"
        aria-label="列"
      >
        <p className="mono meta py-intra-2">列</p>
        <ul className="m-0 list-none border-t border-rule-strong p-0">
          {detail.columns.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[2.4em_minmax(6em,14em)_minmax(8em,1fr)_6em] items-baseline gap-intra-2 border-b border-rule py-[4px] text-[0.8125rem] max-narrow:grid-cols-[2.4em_minmax(0,1fr)]"
            >
              <span className="mono font-semibold text-now" aria-hidden="true">
                {c.pk ? "PK" : ""}
              </span>
              <span className="mono font-semibold">{c.name}</span>
              <span className="mono meta max-narrow:col-start-2">{c.type}</span>
              <span className="mono meta max-narrow:col-start-2">
                {c.nullable ? "null 可" : "not null"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-h-0 flex-auto flex-col" aria-label="先頭の行">
        <p className="mono meta py-intra-2">先頭 {limit} 行</p>
        <div className="min-h-0 flex-auto overflow-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr>
                {detail.head.map((c) => (
                  <th
                    key={c}
                    className="mono meta border-b border-rule-strong py-[5px] ps-0 pe-intra-2 text-start whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className="mono border-b border-rule py-[5px] ps-0 pe-intra-2 text-start whitespace-nowrap"
                    >
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
  );
}
