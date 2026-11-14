import { clsx } from "clsx";
import type { ComponentPropsWithRef, MouseEvent } from "react";
import { type ButtonStyleOptions, buttonClassName } from "./buttonClassName";

export type { ButtonSize, ButtonVariant } from "./buttonClassName";

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
