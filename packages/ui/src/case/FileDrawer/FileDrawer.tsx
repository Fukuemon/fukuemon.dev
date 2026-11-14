import { clsx } from "clsx";
import { type ReactNode, useEffect, useId, useRef } from "react";

export type FileDrawerProps = {
  /** true の間、`showModal` で開く。 */
  isOpen: boolean;
  /** Esc のキー、閉じるボタン、外の薄い墨の面のクリックで閉じるときに呼ぶ。isOpen を false にするのは呼び出す側である。 */
  onClose: () => void;
  /** ドロワーの題（プロジェクトの名前）。`aria-labelledby` で名前にする。 */
  title: string;
  /** 題の下の補足。 */
  description?: string;
  /** 開いたときにフォーカスを移す要素の CSS のセレクタ。見つからなければ、ブラウザのデフォルトのとおり最初の押せる要素に移す。 */
  initialFocus?: string;
  children: ReactNode;
};

/**
 * 狭い配置で、ファイルの木を画面の左から重ねて出すモーダルの面。`<dialog>` の `showModal` で開き、外を操作できなくする。
 * 面は横から滑らせず、濃度を上げて出す（docs/adr/0028-radius-shadow-and-brush-motion.md）。
 * 閉じると、ブラウザが開く前にフォーカスのあった要素へフォーカスを戻す。
 */
export function FileDrawer({
  isOpen,
  onClose,
  title,
  description,
  initialFocus,
  children,
}: FileDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      if (initialFocus !== undefined) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen, initialFocus]);

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- 外の面のクリックはマウスと指の便宜で、キーボードでは Esc のキーと閉じるボタンで閉じる
    <dialog
      aria-labelledby={titleId}
      className={clsx(
        "m-0 h-dvh max-h-none w-5/6 max-w-80 border-r border-border-field bg-surface-raised p-0 text-text shadow-raised",
        "open:flex open:animate-fade-in open:flex-col backdrop:animate-fade-in backdrop:bg-overlay",
      )}
      // Esc のキーでは、ブラウザが自分で閉じるのを止め、閉じるかを呼び出す側の isOpen に任せる
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 外の面のクリックは、dialog 自身へのクリックとして届く
        if (event.target === event.currentTarget) onClose();
      }}
      ref={ref}
    >
      <span aria-hidden="true" className="block h-1 shrink-0 animate-stroke bg-text stroke-brush" />
      <div className="flex shrink-0 items-start justify-between gap-2 py-1 pr-1 pl-3">
        <div className="min-w-0 py-2">
          <h2 className="truncate text-label-compact text-text" id={titleId}>
            {title}
          </h2>
          {description !== undefined && (
            <p className="text-compact text-text-secondary">{description}</p>
          )}
        </div>
        <button
          aria-label="閉じる"
          className="inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-control hover:bg-surface-subtle focus-visible:focus-ring-inset"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
            <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </dialog>
  );
}
