import type { ReactNode } from "react";

export type DisclosureProps = {
  /** 閉じていても読める要約。 */
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/**
 * 要約を押すと中身を開閉する枠。DADS のアコーディオンを元にする。
 * JavaScript なしでも開閉できるよう、`<details>` と `<summary>` だけで組む。
 */
export function Disclosure({ summary, children, defaultOpen = false }: DisclosureProps) {
  return (
    <details className="group border-y border-border" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control px-2 py-2 text-body-dense font-bold text-text hover:bg-surface-subtle focus-visible:focus-ring">
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
      <div className="px-2 pt-2 pb-4 pl-8 text-body text-text">{children}</div>
    </details>
  );
}
