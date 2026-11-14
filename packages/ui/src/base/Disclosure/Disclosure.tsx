import { clsx } from "clsx";
import type { ReactNode } from "react";

export type DisclosureProps = {
  /** 閉じていても読める要約。 */
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** compact は、要約を 24px の高さと太字の 13px にし、中身の余白を詰める。要約の高さは、触る端末（pointer: coarse）では 44px にする（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）。コードを動かす画面に使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。 */
  density?: "default" | "compact";
};

/**
 * 要約を押すと中身を開閉する枠。DADS のアコーディオンを元にする。
 * JavaScript なしでも開閉できるよう、`<details>` と `<summary>` だけで組む。
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  density = "default",
}: DisclosureProps) {
  const isCompact = density === "compact";
  return (
    <details className="group border-y border-border" open={defaultOpen}>
      <summary
        className={clsx(
          "flex cursor-pointer list-none items-center text-text focus-visible:focus-ring",
          isCompact
            ? "rounded-control-compact hover:bg-surface-pane-subtle min-h-6 gap-1 px-1 py-0.5 text-label-compact pointer-coarse:min-h-11"
            : "min-h-11 gap-2 rounded-control px-2 py-2 text-body-dense font-bold hover:bg-surface-subtle",
        )}
      >
        <svg
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-90"
          height="16"
          viewBox="0 0 16 16"
          width="16"
        >
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {summary}
      </summary>
      <div
        className={clsx(
          "text-text",
          isCompact ? "px-1 pt-1 pb-2 pl-6 text-body-compact" : "px-2 pt-2 pb-4 pl-8 text-body",
        )}
      >
        {children}
      </div>
    </details>
  );
}
