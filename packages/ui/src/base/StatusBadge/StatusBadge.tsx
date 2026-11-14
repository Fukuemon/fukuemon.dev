import { clsx } from "clsx";

/** 印の種類。neutral は成否を持たない状態（記事の種別など）に使う。 */
export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export type StatusBadgeProps = {
  tone?: StatusBadgeTone;
  /** 状態を表す文字。色だけで状態を伝えないため、必ず渡す。 */
  label: string;
  /** compact は文字を 12px にする。コードを動かす画面の HTTP の流れに使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。 */
  density?: "default" | "compact";
};

const toneClassName: Record<StatusBadgeTone, string> = {
  neutral: "border-border bg-surface-subtle",
  info: "border-info bg-info-surface",
  success: "border-success bg-success-surface",
  warning: "border-warning bg-warning-surface",
  danger: "border-danger bg-danger-surface",
};

/** 状態を文字と色で示す印。DADS のラベルを元にする。押せない。 */
export function StatusBadge({ tone = "neutral", label, density = "default" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center border whitespace-nowrap text-text",
        density === "compact" ? "px-1.5 text-compact" : "px-2 text-caption",
        toneClassName[tone],
      )}
    >
      {label}
    </span>
  );
}
