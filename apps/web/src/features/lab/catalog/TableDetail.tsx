import { cellText } from "../runtime/cell";
import type { Column } from "./catalog";

export type Detail = { columns: Column[]; head: string[]; rows: unknown[][] };

export default function TableDetail({ detail, limit }: { detail: Detail; limit: number }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden max-narrow:overflow-y-auto">
      <section
        className="min-h-0 flex-initial overflow-y-auto py-intra-2 leading-[1.6] text-fg-2 max-narrow:flex-none max-narrow:overflow-visible"
        aria-label="列"
      >
        <p className="mono meta py-intra-2">列</p>
        <ul className="m-0 list-none border-t border-rule-strong p-0">
          {detail.columns.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[2.4em_minmax(6em,14em)_minmax(8em,1fr)_6em] items-baseline gap-intra-2 border-b border-rule py-intra-0 text-[0.8125rem] max-narrow:grid-cols-[2.4em_auto_minmax(0,1fr)] max-narrow:gap-y-0"
            >
              <span className="mono font-semibold text-now" aria-hidden="true">
                {c.pk ? "PK" : ""}
              </span>
              <span className="mono font-semibold max-narrow:col-span-2">{c.name}</span>
              <span className="mono meta max-narrow:col-start-2">{c.type}</span>
              <span className="mono meta">{c.nullable ? "null 可" : "not null"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="flex min-h-0 flex-auto flex-col max-narrow:flex-none"
        aria-label="先頭の行"
      >
        <p className="mono meta py-intra-2">先頭 {limit} 行</p>
        <div className="min-h-0 flex-auto overflow-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr>
                {detail.head.map((c) => (
                  <th
                    key={c}
                    className="mono meta border-b border-rule-strong py-intra-0 ps-0 pe-intra-2 text-start whitespace-nowrap"
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
                      className="mono border-b border-rule py-intra-0 ps-0 pe-intra-2 text-start whitespace-nowrap"
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
