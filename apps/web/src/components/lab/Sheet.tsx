import type { ReactNode, RefObject } from "react";

type Props = {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** `<dialog>` は top layer に出るので、側柱の overflow に切られない */
export default function Sheet({ ref, title, meta, onClose, children }: Props) {
  return (
    <dialog ref={ref} className="sheet" onClose={onClose}>
      <header className="sheet__head">
        <span className="mono sheet__name">{title}</span>
        {meta !== undefined && <span className="mono meta">{meta}</span>}
        <button type="button" className="btn sheet__close" onClick={() => ref.current?.close()}>
          閉じる
        </button>
      </header>
      {children}
    </dialog>
  );
}
