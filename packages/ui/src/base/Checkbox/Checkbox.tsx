import { type ComponentPropsWithRef } from "react";

export type CheckboxProps = Omit<
  ComponentPropsWithRef<"input">,
  "id" | "className" | "style" | "type" | "children"
> & {
  /** チェックボックスの見出し。`<label>` で結ぶので、文字を押しても切り替わる。 */
  label: string;
};

/**
 * 選ぶか選ばないかの 2 択のチェックボックス。ブラウザの `<input type="checkbox">` を使う。
 * 無効のときはブラウザの `disabled` で表し、フォーカスを受けない。
 * 見出しを含む行全体が押せる領域で、高さは 44px である。
 */
export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="group/row inline-flex min-h-11 cursor-pointer items-center gap-3 text-body-dense text-text has-disabled:cursor-not-allowed has-disabled:text-text-disabled">
      <span className="relative inline-flex size-5 shrink-0">
        <input
          {...props}
          className="peer size-5 cursor-pointer appearance-none disabled:cursor-not-allowed rounded-control bg-surface ring-1 ring-border-field ring-inset not-disabled:not-checked:group-hover/row:bg-surface-subtle not-disabled:not-checked:group-hover/row:ring-text checked:bg-primary checked:ring-primary not-disabled:checked:group-hover/row:bg-primary-hover focus-visible:focus-ring disabled:bg-surface-disabled disabled:ring-border disabled:checked:bg-text-disabled disabled:checked:ring-text-disabled forced-frame checked:forced-on disabled:forced-off-disabled disabled:checked:forced-on-disabled"
          type="checkbox"
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden text-text-inverse peer-checked:block forced-colors:text-(--fd-forced-on-text) forced-colors:peer-disabled:text-[Canvas]"
          height="20"
          viewBox="0 0 20 20"
          width="20"
        >
          <path d="M5 10.5l3.5 3.5L15 6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      {label}
    </label>
  );
}
