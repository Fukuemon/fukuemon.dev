import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type LinkProps = Omit<ComponentPropsWithRef<"a">, "className" | "style"> & {
  href: string;
  /** true のときは新しいタブで開き、そのことを名前に足して読み上げる。 */
  isExternal?: boolean;
  /** true のときは、記事の一覧の題のように文中に置かないリンクの形にし、左右を空けない。 */
  isStandalone?: boolean;
};

/**
 * 内部と外部のリンク。下線を引き、hover で下線の下に 2px の罫を左から引く。折り返したリンクでは行ごとに引く。内部のリンクは link、外部のリンクは link-external の色にする。訪問済みのリンクは色で分けない。
 * フォーカスの表示は外へ 6px 広がるので、文中では左右に 6px を空け、前後の文字に重ねない。文中に置かないリンクでは空けず、見出しや帯と左端をそろえる。
 * JavaScript なしで動く `<a>` だけを出す。
 */
export function Link({ isExternal = false, isStandalone = false, children, ...props }: LinkProps) {
  return (
    <a
      {...props}
      className={clsx(
        "link-rule link-rule-below-underline underline underline-offset-4 focus-visible:focus-ring",
        !isStandalone && "mx-1.5",
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
