import { clsx } from "clsx";

export type LoadingProps = {
  /** 待っていることを表す文。印が止まっていても伝わるよう、必ず渡して画面に出す。 */
  label: string;
  /** compact は文を 13px にし、罫と文の間を 8px にする。コードを動かす画面の領域の中に使う（docs/adr/0062-dense-text-and-targets-in-playground.md、docs/adr/0067-compact-text-tokens-in-dense-panes.md）。 */
  density?: "default" | "compact";
};

/**
 * 終わりの見えない待ちを示す、罫の印と文。薄い罫の上を、主の色の罫が左から伸びて右へ抜ける。DADS のプログレスインジケーターを元にする。
 * 文は `<output>`（暗黙の `role="status"`）に入れ、読み上げの対象にする。
 */
export function Loading({ label, density = "default" }: LoadingProps) {
  return (
    <output
      className={clsx(
        "inline-flex items-center text-text",
        density === "compact" ? "gap-2 text-body-compact" : "gap-3 text-body-dense",
      )}
    >
      <span
        aria-hidden="true"
        className="relative h-0.5 w-6 shrink-0 overflow-hidden bg-border forced-fill after:absolute after:inset-0 after:animate-loading after:bg-primary after:forced-fill-on"
      />
      {label}
    </output>
  );
}
