import { type ComponentPropsWithRef, useId, useState } from "react";

export type SwitchProps = Omit<
  ComponentPropsWithRef<"button">,
  "className" | "style" | "children" | "role" | "type" | "onChange" | "aria-checked"
> & {
  /** スイッチの見出し。文字を押しても切り替わる。 */
  label: string;
  /** 渡すと、オンかオフを呼び出す側が持つ。 */
  checked?: boolean;
  /** `checked` を渡さないときの、最初の状態。 */
  defaultChecked?: boolean;
  /** 切り替わった後の状態を受ける。 */
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * オンとオフを切り替えるスイッチ。APG の Switch に従い、`role="switch"` を持つ。
 * 状態は色のほかに、つまみの位置（右がオン）と、つまみの中の印で示す。
 * 無効のときは `aria-disabled` で表し、フォーカスを受けたまま切り替えを止める。
 */
export function Switch({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  onClick,
  ...props
}: SwitchProps) {
  const labelId = useId();
  const [innerChecked, setInnerChecked] = useState(defaultChecked);
  const isChecked = checked ?? innerChecked;

  return (
    <label
      className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-body-dense text-text has-aria-disabled:cursor-not-allowed has-aria-disabled:text-text-disabled"
      id={labelId}
    >
      <button
        {...props}
        aria-checked={isChecked}
        aria-disabled={disabled || undefined}
        aria-labelledby={labelId}
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center aria-disabled:cursor-not-allowed rounded-control bg-surface ring-1 ring-border-field ring-inset focus-visible:focus-ring aria-checked:bg-primary aria-checked:ring-primary aria-disabled:bg-surface-disabled aria-disabled:ring-border aria-disabled:aria-checked:bg-text-disabled aria-disabled:aria-checked:ring-text-disabled"
        onClick={(event) => {
          onClick?.(event);
          if (disabled || event.defaultPrevented) return;
          if (checked === undefined) setInnerChecked(!isChecked);
          onCheckedChange?.(!isChecked);
        }}
        role="switch"
        type="button"
      >
        <span
          aria-hidden
          className="absolute left-0.5 flex size-5 items-center justify-center rounded-control bg-text text-text-inverse transition-transform group-aria-checked:translate-x-5 group-aria-checked:bg-surface group-aria-checked:text-primary group-aria-disabled:bg-text-disabled group-aria-disabled:group-aria-checked:bg-surface group-aria-disabled:group-aria-checked:text-text-disabled"
        >
          <svg
            className="hidden group-aria-checked:block"
            height="14"
            viewBox="0 0 14 14"
            width="14"
          >
            <path d="M3 7.5l2.8 2.8L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        </span>
      </button>
      {label}
    </label>
  );
}
