import type { ReactNode, RefObject } from "react";

type Props = {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** `<dialog>` は top layer に出るので、サイドバーの overflow に切られない */
export default function Sheet({ ref, title, meta, onClose, children }: Props) {
  return (
    <dialog
      ref={ref}
      className="sheet open:flex w-[min(92vw,var(--measure-wide))] max-h-[82dvh] flex-col border border-rule-strong bg-paper px-(--gutter) py-inter-1 text-fg"
      onClose={onClose}
    >
      <header className="sheet__head flex flex-wrap items-baseline gap-x-intra-3 gap-y-intra-2 border-b-2 border-rule-strong pb-intra-2">
        <span className="mono text-[1.05rem] font-semibold whitespace-nowrap">{title}</span>
        {meta !== undefined && <span className="mono meta">{meta}</span>}
        <button
          type="button"
          className="btn sheet__close ms-auto flex-none whitespace-nowrap"
          onClick={() => ref.current?.close()}
        >
          閉じる
        </button>
      </header>
      {children}
    </dialog>
  );
}
