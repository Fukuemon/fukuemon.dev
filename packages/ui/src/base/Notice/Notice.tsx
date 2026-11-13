import { clsx } from "clsx";
import type { ReactNode } from "react";

/** 知らせの種類。色と印のほかに、題の文で種類を伝える。 */
export type NoticeTone = "info" | "success" | "warning" | "danger";

export type NoticeProps = {
  tone?: NoticeTone;
  title: string;
  children?: ReactNode;
  /** true のときは `role="alert"` にし、出た時点で読み上げる。実行のエラーのように、後から出す知らせに使う。 */
  isAlert?: boolean;
  /** compact は、余白を 8px、題と本文を 13px、印を 16px にする。コードを動かす画面の領域の中に使う（docs/adr/0062-dense-text-and-targets-in-playground.md、docs/adr/0067-compact-text-tokens-in-dense-panes.md）。 */
  density?: "default" | "compact";
};

const toneClassName: Record<NoticeTone, string> = {
  info: "border-info bg-info-surface",
  success: "border-success bg-success-surface",
  warning: "border-warning bg-warning-surface",
  danger: "border-danger bg-danger-surface",
};

const iconClassName: Record<NoticeTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const ICON_PATH: Record<NoticeTone, string> = {
  info: "M10 9v5M10 6v1",
  success: "M6 10l3 3 5-6",
  warning: "M10 5v6M10 14v1",
  danger: "M7 7l6 6M13 7l-6 6",
};

/**
 * 題と本文を持つ注意の枠。DADS のノティフィケーションバナーを元にする。
 * 記事の注意書きは、ページを開いたときに読み上げると本文の流れを切るので、`role` を付けない。
 */
export function Notice({
  tone = "info",
  title,
  children,
  isAlert = false,
  density = "default",
}: NoticeProps) {
  const isCompact = density === "compact";
  return (
    <div
      className={clsx(
        "flex border-l-2 text-text",
        isCompact ? "gap-2 p-2" : "gap-3 p-4",
        toneClassName[tone],
      )}
      role={isAlert ? "alert" : undefined}
    >
      <svg
        aria-hidden="true"
        className={clsx("shrink-0", iconClassName[tone])}
        height={isCompact ? 16 : 20}
        viewBox="0 0 20 20"
        width={isCompact ? 16 : 20}
      >
        <circle cx="10" cy="10" fill="none" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d={ICON_PATH[tone]} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className={clsx("flex flex-col", isCompact ? "gap-0.5" : "gap-1")}>
        <p className={isCompact ? "text-label-compact" : "text-body-dense font-bold"}>{title}</p>
        {children !== undefined && (
          <div className={isCompact ? "text-body-compact" : "text-body"}>{children}</div>
        )}
      </div>
    </div>
  );
}
