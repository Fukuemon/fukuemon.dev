import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type IconButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "aria-label" | "children" | "className" | "style"
> & {
  /** 読み上げる名前。印だけのボタンなので必ず渡す。 */
  label: string;
  /** ボタンに描く印。`aria-hidden` の SVG を渡す。 */
  icon: React.ReactNode;
  /** compact は押せる領域を 28×28 px にする。コードを動かす画面の帯に置くボタンに使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。 */
  density?: "default" | "compact";
};

/**
 * 印だけのボタン。押せる領域は 44×44 px にする。density が compact のときは 28×28 px にする。
 * 名前は label を `aria-label` に渡し、印には名前を持たせない。
 */
export function IconButton({
  label,
  icon,
  density = "default",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={clsx(
        "inline-grid cursor-pointer place-items-center rounded-control text-text hover:bg-surface-subtle focus-visible:focus-ring",
        density === "compact" ? "size-7" : "size-11",
      )}
      type={type}
    >
      {icon}
    </button>
  );
}
