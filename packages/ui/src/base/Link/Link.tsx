import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type LinkProps = ComponentPropsWithRef<"a"> & {
  href: string;
  /** true のときは新しいタブで開き、そのことを名前に足して読み上げる。 */
  isExternal?: boolean;
};

/**
 * 文中のリンク。DADS のリンクの色で下線を引き、訪問済みのリンクを別の色にする。
 * JavaScript なしで動く `<a>` だけを出す。
 */
export function Link({ isExternal = false, className, children, ...props }: LinkProps) {
  return (
    <a
      {...props}
      className={clsx(
        "rounded-sm text-link underline underline-offset-4 visited:text-link-visited hover:decoration-2 focus-visible:focus-ring",
        className,
      )}
      rel={isExternal ? "noopener noreferrer" : props.rel}
      target={isExternal ? "_blank" : props.target}
    >
      {children}
      {isExternal && <span className="sr-only">（新しいタブで開く）</span>}
    </a>
  );
}
