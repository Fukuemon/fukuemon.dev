import { clsx } from "clsx";
import { type ReactNode, createContext, use, useId } from "react";

export type TableProps = {
  /** 表の題。`<caption>` に出し、横に送る枠の名前にもする。 */
  caption: string;
  children: ReactNode;
  /** compact は、セルの余白を上下 2px、左右 8px、文字を 13px にする。コードを動かす画面に使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。 */
  density?: "default" | "compact";
};

const DensityContext = createContext<"default" | "compact">("default");

const cellClassName = (density: "default" | "compact") =>
  clsx("text-left align-top", density === "compact" ? "px-2 py-0.5" : "px-4 py-2");

/**
 * 同じ項目を持つ行を並べる表。DADS のテーブルを元にする。Table.Header、Table.Body、Table.Row、Table.HeaderCell、Table.Cell で組む。
 * 幅に収まらない表は横に送る。送る枠は、キーボードで送れるよう Tab のキーの順に入れ、表の題を名前にする。
 */
export function Table({ caption, children, density = "default" }: TableProps) {
  const captionId = useId();
  return (
    <section
      aria-labelledby={captionId}
      className="scroll-fade-end overflow-x-auto focus-visible:focus-ring"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 横に送る領域は、キーボードで送れるよう tabIndex={0} を付ける (WCAG 2.1.1)
      tabIndex={0}
    >
      <table
        className={clsx(
          "w-full border-collapse text-text",
          density === "compact" ? "text-body-compact" : "text-body-dense",
        )}
      >
        <caption
          className={clsx("text-left font-bold", density === "compact" ? "pb-1" : "pb-2")}
          id={captionId}
        >
          {caption}
        </caption>
        <DensityContext value={density}>{children}</DensityContext>
      </table>
    </section>
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
    <th className={clsx(cellClassName(use(DensityContext)), "font-bold")} scope={scope}>
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className={cellClassName(use(DensityContext))}>{children}</td>;
}

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.HeaderCell = TableHeaderCell;
Table.Cell = TableCell;
