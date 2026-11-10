import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type IconButtonProps = Omit<ComponentPropsWithRef<"button">, "aria-label" | "children"> & {
  /** 読み上げる名前。印だけのボタンなので必ず渡す。 */
  label: string;
  /** ボタンに描く印。`aria-hidden` の SVG を渡す。 */
  icon: React.ReactNode;
};

/**
 * 印だけのボタン。押せる領域は 44×44 px にする。
 * 名前は label を `aria-label` に渡し、印には名前を持たせない。
 */
export function IconButton({ label, icon, className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={clsx(
        "inline-grid size-11 cursor-pointer place-items-center rounded-md text-text hover:bg-surface-subtle focus-visible:focus-ring",
        className,
      )}
      type={type}
    >
      {icon}
    </button>
  );
}
