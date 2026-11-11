import { clsx } from "clsx";
import { type ComponentPropsWithRef, useId } from "react";

export type TextFieldProps = Omit<ComponentPropsWithRef<"input">, "id" | "className" | "style"> & {
  /** 欄の見出し。`<label>` で欄に結ぶ。 */
  label: string;
  /** 見出しの下に出す補足。`aria-describedby` で欄に結ぶ。 */
  description?: string;
  /** 誤りの文。渡すと欄を `aria-invalid` にし、`aria-describedby` で欄に結ぶ。`role="alert"` は付けない。 */
  error?: string;
  /** true のときは見出しを画面に出さず、読み上げにだけ渡す。欄の役割を、隣のボタンの文か置き場で示せるときだけに使う。 */
  isLabelHidden?: boolean;
  /** 欄の形。`underline` は下の 1 辺だけに枠を引き、ヘッダーのように面の上に溶け込ませる欄に使う。 */
  appearance?: "boxed" | "underline";
};

/**
 * 1 行の文字の入力欄。見出し、補足、誤りの文を欄に結ぶ。
 * 欄の高さは 48px で、押せる領域は 44px より大きい。
 */
export function TextField({
  label,
  description,
  error,
  required,
  isLabelHidden = false,
  appearance = "boxed",
  ...props
}: TextFieldProps) {
  const id = useId();
  const descriptionId = description === undefined ? undefined : `${id}-description`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label className={clsx("text-label text-text", isLabelHidden && "sr-only")} htmlFor={id}>
        {label}
        {required && <span className="ml-2 text-caption text-danger">必須</span>}
      </label>
      {description !== undefined && (
        <p className="text-caption text-text-secondary" id={descriptionId}>
          {description}
        </p>
      )}
      <input
        {...props}
        aria-describedby={describedBy}
        aria-invalid={error === undefined ? undefined : true}
        className={clsx(
          "h-12 bg-surface text-body-dense text-text",
          appearance === "boxed"
            ? "px-4 ring-1 ring-border-field ring-inset"
            : "border-b border-border-field px-1",
          "focus-visible:focus-ring",
          appearance === "boxed"
            ? "aria-invalid:ring-2 aria-invalid:ring-danger"
            : "aria-invalid:border-b-2 aria-invalid:border-danger",
          "disabled:bg-surface-disabled disabled:text-text-disabled",
        )}
        id={id}
        required={required}
      />
      {error !== undefined && (
        <p className="flex items-center gap-1 text-caption text-danger" id={errorId}>
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
            <circle cx="8" cy="8" fill="none" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v5M8 11v1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
