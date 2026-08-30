import { cellText } from "./cell";
import type { Result } from "./useRunner";

export default function ResultTable({ result }: { result: Result }) {
  if (result.columns.length === 0) return null;
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
        // 左端を操作行と揃える
        <p className="mono meta runner__more m-0 px-intra-3 py-intra-2">
          先頭 {result.rows.length} 行だけを出しています (全 {result.total} 行)
        </p>
      )}
    </>
  );
}
