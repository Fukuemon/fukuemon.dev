import { clsx } from "clsx";
import { type ReactNode, useEffect, useId, useRef } from "react";

export type DialogProps = {
  /** true の間、`showModal` で開く。 */
  isOpen: boolean;
  /** Esc のキー、閉じるボタン、背景のクリックで閉じるときに呼ぶ。isOpen を false にするのは呼び出す側である。 */
  onClose: () => void;
  /** ダイアログの題。`aria-labelledby` で名前にする。 */
  title: string;
  children: ReactNode;
  /** 下端に並べる操作のボタン。主のボタンは 1 つまでにする。 */
  footer?: ReactNode;
};

/**
 * モーダルのダイアログ。`<dialog>` の `showModal` で開き、外を操作できなくする。
 * 閉じると、ブラウザが開く前にフォーカスのあった要素へフォーカスを戻す。
 */
export function Dialog({ isOpen, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={clsx(
        "m-auto w-full max-w-lg rounded-lg bg-surface-raised p-0 text-text shadow-3",
        "backdrop:bg-overlay",
      )}
      // Esc のキーでは、ブラウザが自分で閉じるのを止め、閉じるかを呼び出す側の isOpen に任せる
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 背景のクリックは、dialog 自身へのクリックとして届く
        if (event.target === event.currentTarget) onClose();
      }}
      ref={ref}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-heading-sm font-semibold" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="閉じる"
            className="-m-2 inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-surface-subtle focus-visible:focus-ring"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        <div className="text-body">{children}</div>
        {footer !== undefined && <div className="flex justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  );
}
