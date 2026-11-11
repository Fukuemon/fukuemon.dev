import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type LinkProps = Omit<ComponentPropsWithRef<"a">, "className" | "style"> & {
  href: string;
  /** true のときは新しいタブで開き、そのことを名前に足して読み上げる。 */
  isExternal?: boolean;
};

/**
 * 文中のリンク。下線を引き、内部のリンクは link、外部のリンクは link-external の色にする。訪問済みのリンクは色で分けない。
 * JavaScript なしで動く `<a>` だけを出す。
 */
export function Link({ isExternal = false, children, ...props }: LinkProps) {
  return (
    <a
      {...props}
      className={clsx(
        "underline underline-offset-4 hover:decoration-2 focus-visible:focus-ring",
        isExternal ? "text-link-external" : "text-link visited:text-link-visited",
      )}
      rel={isExternal ? "noopener noreferrer" : props.rel}
      target={isExternal ? "_blank" : props.target}
    >
      {children}
      {isExternal && <span className="sr-only">（新しいタブで開く）</span>}
    </a>
  );
}
