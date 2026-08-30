import { cellText } from "./cell";
import type { Column } from "./catalog";

export type Detail = { columns: Column[]; head: string[]; rows: unknown[][] };

/** 1 テーブルの中身。列の定義と、先頭の行 */
export default function TableDetail({ detail, limit }: { detail: Detail; limit: number }) {
  return (
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
        <p className="mono meta sheet__sub">先頭 {limit} 行</p>
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
  );
}
