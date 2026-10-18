import { cellText } from "../runtime/cell";
import type { Result } from "../runtime/useRunner";

/** EXPLAIN の結果。1 行が計画の 1 行なので、表の罫で区切らずに 1 枚の文として出す */
const isPlan = (result: Result) =>
  result.columns.length === 1 && result.columns[0] === "QUERY PLAN";

export default function ResultTable({ result }: { result: Result }) {
  if (result.columns.length === 0) return null;
  if (isPlan(result)) {
    return (
      <div className="runner__scroll overflow-x-auto border-t border-rule-strong">
        <p className="mono meta m-0 px-intra-3 pt-intra-2 max-narrow:px-intra-2">QUERY PLAN</p>
        <pre className="runner__plan mono m-0 w-max min-w-full px-intra-3 py-intra-2 max-narrow:px-intra-2">
          {result.rows.map((row) => cellText(row[0])).join("\n")}
        </pre>
      </div>
    );
  }
  return (
    <>
      <div className="runner__scroll overflow-x-auto border-t border-rule-strong">
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
        <p className="mono meta runner__more m-0 px-intra-3 py-intra-2">
          先頭 {result.rows.length} 行だけを出しています (全 {result.total} 行)
        </p>
      )}
    </>
  );
}
