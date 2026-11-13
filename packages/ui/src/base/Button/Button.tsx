import { clsx } from "clsx";
import type { ComponentPropsWithRef, MouseEvent } from "react";

/** ボタンの見た目の種類。primary は画面の主の操作で、1 つの画面に 1 つまでにする。danger はデータを失う操作を確定するボタンである。 */
export type ButtonVariant = "primary" | "secondary" | "danger";
/** ボタンの高さ。S は 40px で、見た目の外まで 44px を押せる。M は 48px である。 */
export type ButtonSize = "S" | "M";

/** ボタンの見た目の指定。 */
type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: "bg-primary text-text-inverse not-aria-disabled:not-aria-busy:hover:bg-primary-hover",
  secondary: "bg-surface text-primary ring-1 ring-border-field ring-inset",
  danger: "bg-danger text-text-inverse not-aria-disabled:not-aria-busy:hover:bg-danger-hover",
};

const sizeClassName: Record<ButtonSize, string> = {
  S: "h-10 min-w-11 px-4 after:absolute after:inset-x-0 after:-inset-y-0.5",
  M: "h-12 min-w-11 px-5",
};

const buttonClassName = ({ variant = "primary", size = "M" }: ButtonStyleOptions = {}) =>
  clsx(
    "relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-control text-label ink-press",
    "not-aria-disabled:not-aria-busy:active:brightness-90",
    "focus-visible:focus-ring",
    "aria-disabled:cursor-not-allowed aria-disabled:bg-surface-disabled aria-disabled:text-text-disabled aria-disabled:ring-0",
    variantClassName[variant],
    sizeClassName[size],
  );

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "className" | "style"> &
  ButtonStyleOptions & {
    /** true の間は子の文を隠して 3 つの点の印を重ね、クリックを無視する。子の文はボタンの名前として残す。 */
    isLoading?: boolean;
  };

/**
 * 操作のボタン。type のデフォルトは button である。
 * disabled は `aria-disabled` で表し、フォーカスを受けたまま、クリックと送信を止める。押せない理由を、近くの文で伝えられるようにするためである。
 */
export function Button({
  variant,
  size,
  isLoading = false,
  children,
  onClick,
  type = "button",
  disabled = false,
  ...props
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      aria-disabled={disabled || undefined}
      className={buttonClassName({ variant, size })}
      onClick={handleClick}
      type={type}
    >
      <span className={clsx(isLoading && "opacity-0")}>{children}</span>
      {isLoading && (
        <span aria-hidden className="absolute loading-dots">
          <span />
          <span />
          <span />
        </span>
      )}
    </button>
  );
}
