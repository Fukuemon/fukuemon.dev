import { type ReactNode, useId } from "react";

export type TableProps = {
  /** 表の題。`<caption>` に出し、横に送る枠の名前にもする。 */
  caption: string;
  children: ReactNode;
};

/**
 * 同じ項目を持つ行を並べる表。DADS のテーブルを元にする。Table.Header、Table.Body、Table.Row、Table.HeaderCell、Table.Cell で組む。
 * 幅に収まらない表は横に送る。送る枠は、キーボードで送れるよう Tab のキーの順に入れ、表の題を名前にする。
 */
export function Table({ caption, children }: TableProps) {
  const captionId = useId();
  return (
    <div
      aria-labelledby={captionId}
      className="overflow-x-auto focus-visible:focus-ring"
      role="region"
      tabIndex={0}
    >
      <table className="w-full border-collapse text-body-dense text-text">
        <caption className="pb-2 text-left font-bold" id={captionId}>
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="border-t-2 border-text *:border-text">{children}</thead>;
}

function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-border">{children}</tr>;
}

export type TableHeaderCellProps = {
  children: ReactNode;
  /** col は列の見出し、row は行の見出しである。 */
  scope?: "col" | "row";
};

function TableHeaderCell({ children, scope = "col" }: TableHeaderCellProps) {
  return (
    <th className="px-4 py-2 text-left align-top font-bold" scope={scope}>
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-2 text-left align-top">{children}</td>;
}

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.HeaderCell = TableHeaderCell;
Table.Cell = TableCell;
