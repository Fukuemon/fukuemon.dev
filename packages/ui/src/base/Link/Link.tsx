import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

export type LinkProps = Omit<ComponentPropsWithRef<"a">, "className" | "style"> & {
  href: string;
  /** true のときは新しいタブで開き、そのことを名前に足して読み上げる。 */
  isExternal?: boolean;
  /** true のときは、記事の一覧の題のように文中に置かないリンクの形にし、左右を空けない。 */
  isStandalone?: boolean;
  /** true のときは、押せる領域を 44×44 CSS px 以上に広げる。文中では行の高さが崩れるので、`isStandalone` と一緒に使う。 */
  isLargeTarget?: boolean;
};

const RULE = "link-rule link-rule-below-underline underline underline-offset-4";

/**
 * 内部と外部のリンク。下線を引き、hover で下線の下に 2px の罫を左から引く。文中のリンクが折り返したときは行ごとに引く。文中に置かないリンクを flex の子にして折り返したときは、最後の行の下にだけ引く。内部のリンクは link、外部のリンクは link-external の色にする。訪問済みのリンクは色で分けない。
 * フォーカスの表示は外へ 4px 広がるので、文中では左右に 6px を空け、前後の文字に重ねない。文中に置かないリンクでは空けず、見出しや帯と左端をそろえる。
 * 押せる領域を広げるときは、下線と罫を中の文字の span に付ける。リンクの箱に付けると、罫が箱の下端に出て下線から離れるためである。
 * JavaScript なしで動く `<a>` だけを出す。
 */
export function Link({
  isExternal = false,
  isStandalone = false,
  isLargeTarget = false,
  children,
  ...props
}: LinkProps) {
  return (
    <a
      {...props}
      className={clsx(
        "focus-visible:focus-ring",
        isLargeTarget ? "inline-flex min-h-11 min-w-11 items-center" : RULE,
        !isStandalone && "mx-1.5",
        isExternal ? "text-link-external" : "text-link visited:text-link-visited",
      )}
      rel={isExternal ? "noopener noreferrer" : props.rel}
      target={isExternal ? "_blank" : props.target}
    >
      {isLargeTarget ? <span className={RULE}>{children}</span> : children}
      {isExternal && <span className="sr-only">（新しいタブで開く）</span>}
    </a>
  );
}
