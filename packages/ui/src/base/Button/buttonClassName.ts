import { clsx } from "clsx";

/** ボタンの見た目の種類。primary は画面の主の操作で、1 つの画面に 1 つまでにする。danger はデータを失う操作を確定するボタンである。 */
export type ButtonVariant = "primary" | "secondary" | "danger";
/**
 * ボタンの高さ。S は 40px で、見た目の外まで 44px を押せる。M は 48px である。
 * XS は 28px で、文字を 13px にする。触る端末（pointer: coarse）では 44px にする（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）。コードを動かす画面の帯だけに使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。
 * ほかの Base の density="compact" と違い、Button は高さを size で選ぶので、同じ軸に XS を足している。
 */
export type ButtonSize = "XS" | "S" | "M";

/** ボタンの見た目の指定。 */
export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: "bg-primary text-text-inverse not-aria-disabled:not-aria-busy:hover:bg-primary-hover",
  secondary: "bg-surface text-primary ring-1 ring-border-field ring-inset",
  danger: "bg-danger text-text-inverse not-aria-disabled:not-aria-busy:hover:bg-danger-hover",
};

const sizeClassName: Record<ButtonSize, string> = {
  XS: "h-7 min-w-7 px-3 text-label-compact pointer-coarse:h-11 pointer-coarse:min-w-11",
  S: "h-10 min-w-11 px-4 text-label after:absolute after:inset-x-0 after:-inset-y-0.5 forced-colors:after:-inset-y-0.75",
  M: "h-12 min-w-11 px-5 text-label",
};

/**
 * Button と同じ見た目のクラス。React を配らない HTML（記事の本文など）に素の `<button>` を置くときに使う。
 * 使う側の CSS は、`@fukuemon/ui/sources.css` を読み込み、このファイルのクラスを Tailwind CSS の走査に入れる。
 */
export const buttonClassName = ({ variant = "primary", size = "M" }: ButtonStyleOptions = {}) =>
  clsx(
    "relative inline-flex cursor-pointer items-center justify-center gap-2 ink-press",
    size === "XS" ? "rounded-control-compact" : "rounded-control",
    "not-aria-disabled:not-aria-busy:active:brightness-90",
    "focus-visible:focus-ring",
    "forced-frame aria-disabled:forced-off-disabled",
    "aria-disabled:cursor-not-allowed aria-disabled:bg-surface-disabled aria-disabled:text-text-disabled aria-disabled:ring-0",
    variantClassName[variant],
    sizeClassName[size],
  );
