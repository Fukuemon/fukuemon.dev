import { clsx } from "clsx";
import { type ComponentPropsWithRef, type ReactNode, useId } from "react";

export type TextFieldProps = Omit<ComponentPropsWithRef<"input">, "id" | "className" | "style"> & {
  /** 欄の見出し。`<label>` で欄に結ぶ。 */
  label: string;
  /** 見出しの下に出す補足。`aria-describedby` で欄に結ぶ。 */
  description?: string;
  /** 誤りの文。渡すと欄を `aria-invalid` にし、`aria-describedby` で欄に結ぶ。`role="alert"` は付けない。 */
  error?: string;
  /** true のときは見出しを画面に出さず、読み上げにだけ渡す。欄の役割を、案内の文（placeholder）と印か、置き場で示せるときだけに使う。 */
  isLabelHidden?: boolean;
  /**
   * 欄の形。`underline` は墨の下罫だけを引き、ヘッダーのように面の上に溶け込ませる欄に使う。
   * 案内の文（placeholder）は明朝になる。hover で罫が 2px になり、フォーカスすると緑の筆の線が左から引かれる。
   * フォーカスの表示は、標準の `focus-ring` の代わりにこの緑の罫が担う（DesignDoc の「フォーカスの表示」の例外）。
   */
  appearance?: "boxed" | "underline";
  /** `underline` の欄の左に置く印。装飾なので読み上げから外す。 */
  leading?: ReactNode;
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
  leading,
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
      {appearance === "boxed" ? (
        <input
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error === undefined ? undefined : true}
          className={clsx(
            "h-12 rounded-control bg-surface px-4 text-body-dense text-text ring-1 ring-border-field ring-inset",
            "focus-visible:focus-ring aria-invalid:ring-2 aria-invalid:ring-danger",
            "disabled:bg-surface-disabled disabled:text-text-disabled",
          )}
          id={id}
          required={required}
        />
      ) : (
        <div className="group relative flex items-center gap-2">
          {leading !== undefined && (
            <span
              aria-hidden
              className="flex shrink-0 pl-1 text-text-secondary group-focus-within:text-primary"
            >
              {leading}
            </span>
          )}
          <input
            {...props}
            aria-describedby={describedBy}
            aria-invalid={error === undefined ? undefined : true}
            className={clsx(
              "peer h-12 min-w-0 flex-1 bg-surface px-1 text-body-dense text-text outline-none",
              "placeholder:font-heading placeholder:font-semibold placeholder:text-text-secondary",
              "disabled:bg-surface-disabled disabled:text-text-disabled",
            )}
            id={id}
            required={required}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px bg-text group-hover:h-0.5 peer-aria-invalid:h-0.5 peer-aria-invalid:bg-danger"
          />
          <span
            aria-hidden
            className="pointer-events-none invisible absolute inset-x-0 bottom-0 h-1 bg-primary stroke-brush peer-focus:visible peer-focus:animate-stroke"
          />
        </div>
      )}
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
