import { useMemo, useRef } from "react";
import { highlightSql } from "./sql-tokens";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
};

/**
 * 重ねる 2 枚で揃える箱。
 * 折り返しと字形が一致しないと文字がずれるので、必ず両方に当てる。
 * 書体そのもの (`font: inherit`) だけは site.css が持つ。
 * utility へ移すと font 一括指定が font-size / line-height の後に出て、両者を潰すためである。
 */
const OVERLAY =
  "m-0 w-full overflow-auto p-intra-3 text-[0.9rem] leading-[1.7] whitespace-pre-wrap [word-break:break-word] [tab-size:2]";

/**
 * 色を付けたまま編集する。
 * 透明な textarea を、同じ座標の色付き pre に重ねる。
 */
export default function SqlEditor({ id, label, value, onChange, onRun }: Props) {
  const ink = useRef<HTMLPreElement>(null);
  const html = useMemo(() => highlightSql(value), [value]);

  return (
    <div className="sqled relative">
      <pre
        className={`sqled__ink mono ${OVERLAY} pointer-events-none absolute inset-0 text-c-plain [background:none]`}
        ref={ink}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <label className="sr" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={`sqled__input mono ${OVERLAY} relative block resize-y bg-transparent text-transparent caret-fg min-h-[5em] selection:bg-tint-green selection:text-c-plain focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2`}
        spellCheck={false}
        rows={Math.min(18, value.split("\n").length + 1)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const el = ink.current;
          if (!el) return;
          el.scrollTop = e.currentTarget.scrollTop;
          el.scrollLeft = e.currentTarget.scrollLeft;
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onRun();
          }
        }}
      />
    </div>
  );
}
