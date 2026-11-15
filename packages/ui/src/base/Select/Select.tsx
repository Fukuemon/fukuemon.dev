import { clsx } from "clsx";
import { type ComponentPropsWithRef, useId } from "react";

export type SelectProps = Omit<ComponentPropsWithRef<"select">, "id" | "className" | "style"> & {
  /** 欄の見出し。欄の左に置き、`<label>` で欄に結ぶ。 */
  label: string;
  /**
   * compact は、欄を 28px の高さ、値と見出しを 13px にする。欄の高さは、触る端末（pointer: coarse）では 44px にする（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）。
   * コードを動かす画面のペインに置く欄に使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。
   */
  density?: "default" | "compact";
};

/**
 * 決まった値から 1 つを選ぶ欄。ブラウザの `<select>` を使い、見出しを左に置く。
 * コードを動かす画面の紙の面に置くので、欄の面は `surface-pane` にする（docs/adr/0073-layered-panes-and-radius-in-playground.md）。
 */
export function Select({ label, density = "default", children, ...props }: SelectProps) {
  const isCompact = density === "compact";
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label
        className={clsx(isCompact ? "text-body-compact" : "text-body-dense", "text-text")}
        htmlFor={id}
      >
        {label}
      </label>
      <select
        {...props}
        className={clsx(
          "bg-surface-pane px-2 text-text ring-1 ring-border-field ring-inset focus-visible:focus-ring",
          "disabled:bg-surface-disabled disabled:text-text-disabled",
          isCompact
            ? "h-7 rounded-control-compact text-body-compact pointer-coarse:h-11"
            : "h-12 rounded-control text-body-dense",
        )}
        id={id}
      >
        {children}
      </select>
    </div>
  );
}
