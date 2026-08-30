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
 * 色を付けたまま編集する。
 * 透明な textarea を、同じ座標の色付き pre に重ねる。
 * 折り返しと字形を一致させないと文字がずれるので、
 * font / padding / white-space / word-break を両者で揃える。
 */
export default function SqlEditor({ id, label, value, onChange, onRun }: Props) {
  const ink = useRef<HTMLPreElement>(null);
  const html = useMemo(() => highlightSql(value), [value]);

  return (
    <div className="sqled">
      <pre className="sqled__ink mono" ref={ink} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
      <label className="sr" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="sqled__input mono"
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
