import { Button, Notice, Table, TreeView } from "@fukuemon/ui";
import type { SqlResponse, SqlResult } from "@fukuemon/sql-runtime";
import { useId, useState } from "react";

import { type JsonPlan, toPlanView } from "./plan";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize, tablePage } from "./result";

const ms = (value: number) => `${value.toFixed(1)} ms`;

function PlanTree({ plan }: { plan: JsonPlan }) {
  const ids: string[] = [];
  const collect = (node: JsonPlan["root"]) => {
    ids.push(node.id);
    node.children?.forEach(collect);
  };
  collect(plan.root);
  return (
    <div className="flex flex-col gap-2">
      <TreeView defaultExpandedIds={ids} items={[plan.root]} label="実行計画" />
      {plan.planningMs !== undefined && (
        <p className="text-body-dense text-text-secondary">Planning Time: {ms(plan.planningMs)}</p>
      )}
      {plan.executionMs !== undefined && (
        <p className="text-body-dense text-text-secondary">
          Execution Time: {ms(plan.executionMs)}
        </p>
      )}
    </div>
  );
}

function RowsTable({ result }: { result: SqlResult }) {
  const sizeId = useId();
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  const range = tablePage(result, pageSize, page);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {result.truncated && (
        <Notice title="結果の行を切りました" tone="warning">
          全体の {result.totalRows.toLocaleString()} 行のうち、先頭の{" "}
          {result.rows.length.toLocaleString()} 行を表示しています。
        </Notice>
      )}
      <Table caption={`結果（${result.totalRows.toLocaleString()} 行）`}>
        <Table.Header>
          <Table.Row>
            {range.columns.map((column) => (
              <Table.HeaderCell key={column.key}>{column.name}</Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {range.rows.map((row) => (
            <Table.Row key={row.key}>
              {row.cells.map((cell) => (
                <Table.Cell key={cell.key}>
                  <span className="font-mono whitespace-pre">{cell.text}</span>
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-body-dense text-text" htmlFor={sizeId}>
            1 ページの行
          </label>
          <select
            className="h-12 rounded-control bg-surface px-2 text-body-dense text-text ring-1 ring-border-field ring-inset focus-visible:focus-ring"
            id={sizeId}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as PageSize);
              setPage(0);
            }}
            value={pageSize}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        {range.pages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              disabled={range.page === 0}
              onClick={() => setPage(range.page - 1)}
              size="S"
              variant="secondary"
            >
              前のページ
            </Button>
            <span className="text-body-dense text-text">
              {range.page + 1} / {range.pages}
            </span>
            <Button
              disabled={range.page === range.pages - 1}
              onClick={() => setPage(range.page + 1)}
              size="S"
              variant="secondary"
            >
              次のページ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultBody({ result }: { result: SqlResult }) {
  const plan = toPlanView(result);
  if (plan?.kind === "json") return <PlanTree plan={plan.plan} />;
  if (plan?.kind === "text") {
    return (
      <section
        aria-label="実行計画"
        className="scroll-fade-end scroll-fade-code overflow-x-auto bg-code-surface focus-visible:focus-ring"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 横に送る領域は、キーボードで送れるよう tabIndex={0} を付ける (WCAG 2.1.1)
        tabIndex={0}
      >
        <pre className="p-4 font-mono text-code text-code-text">{plan.text}</pre>
      </section>
    );
  }
  if (result.fields.length === 0) {
    return (
      <p className="text-body-dense text-text">
        実行しました。{result.affectedRows.toLocaleString()} 行に影響しました。
      </p>
    );
  }
  return <RowsTable result={result} />;
}

export type ResultViewProps = { response: SqlResponse };

/** 1 回の実行の結果。複数の文を実行したときは、最後の文の結果を出す。 */
export function ResultView({ response }: ResultViewProps) {
  if ("error" in response) {
    const { message, code, position } = response.error;
    // SQLSTATE を持つのは Postgres が返したエラーだけである。読み込みの失敗と異常終了では、取り消した文は無い
    if (code === undefined) {
      return (
        <Notice isAlert title="実行できませんでした" tone="danger">
          <span className="font-mono break-all whitespace-pre-wrap">{message}</span>
        </Notice>
      );
    }
    return (
      <Notice isAlert title="SQL が失敗しました" tone="danger">
        <span className="font-mono break-all whitespace-pre-wrap">{message}</span>
        <span className="block">
          SQLSTATE {code}
          {position !== undefined && `、${position} 文字目`}
        </span>
        <span className="block">この実行の文は、全て取り消しました。</span>
      </Notice>
    );
  }
  const last = response.results.at(-1);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-caption text-text-secondary">
        {response.results.length} 個の文を {ms(response.ms)} で実行しました。
      </p>
      {last && <ResultBody result={last} />}
    </div>
  );
}
