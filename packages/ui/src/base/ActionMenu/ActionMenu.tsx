import { clsx } from "clsx";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

/** メニューの項目。isDanger の項目はデータを失う操作で、赤くし、最後に置く。 */
export type ActionMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  isDanger?: boolean;
};

export type ActionMenuProps = {
  /** 開くボタンの読み上げる名前。 */
  label: string;
  items: readonly ActionMenuItem[];
  /** compact はボタンと項目を 28 px の高さ、項目の文字を 13 px にする。コードを動かす画面の帯に置くメニューに使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。 */
  density?: "default" | "compact";
};

/**
 * 「…」のボタンと、押すとボタンの下に開くメニュー。WAI-ARIA APG のメニューボタンのキーボードの操作に従う。
 * 開くと最初の項目へフォーカスを移し、上下の矢印のキーで項目の間を移る。Home と End で端へ移る。
 * 項目を選ぶか、Esc のキーを押すか、メニューの外を押すと閉じる。項目を選んだときと Esc のキーでは、フォーカスをボタンに戻す。
 */
export function ActionMenu({ label, items, density = "default" }: ActionMenuProps) {
  const isCompact = density === "compact";
  const menuId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<HTMLButtonElement[]>([]);
  const [isOpen, setOpen] = useState(false);
  const ordered = [...items.filter((i) => !i.isDanger), ...items.filter((i) => i.isDanger)];

  useEffect(() => {
    if (isOpen) itemRefs.current[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const closeAndFocusButton = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) =>
      itemRefs.current[(index + ordered.length) % ordered.length]?.focus();
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusAt(current + 1),
      ArrowUp: () => focusAt(current - 1),
      Home: () => focusAt(0),
      End: () => focusAt(ordered.length - 1),
      Escape: closeAndFocusButton,
      Tab: () => setOpen(false),
    };
    const action = keys[event.key];
    if (!action) return;
    if (event.key !== "Tab") event.preventDefault();
    action();
  };

  return (
    <span className="relative inline-flex" ref={rootRef}>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className={clsx(
          "inline-grid cursor-pointer place-items-center rounded-control text-text hover:bg-surface-subtle focus-visible:focus-ring",
          isCompact ? "size-7" : "size-11",
        )}
        onClick={() => setOpen(!isOpen)}
        ref={buttonRef}
        type="button"
      >
        <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
          <circle cx="4" cy="10" fill="currentColor" r="1.6" />
          <circle cx="10" cy="10" fill="currentColor" r="1.6" />
          <circle cx="16" cy="10" fill="currentColor" r="1.6" />
        </svg>
      </button>
      {isOpen && (
        <div
          aria-label={label}
          className="absolute top-full right-0 z-10 mt-1 flex min-w-48 animate-fade-in flex-col rounded-control border border-border-field bg-surface-raised py-1 shadow-raised"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          {ordered.map((item, index) => (
            <button
              className={clsx(
                "cursor-pointer text-left hover:bg-surface-subtle focus-visible:focus-ring",
                isCompact ? "min-h-7 px-3 text-body-compact" : "min-h-11 px-4 text-body-dense",
                item.isDanger ? "text-danger" : "text-text",
                item.isDanger && index > 0 && "border-t border-border",
              )}
              key={item.id}
              onClick={() => {
                item.onSelect();
                closeAndFocusButton();
              }}
              ref={(node) => {
                if (node) itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
