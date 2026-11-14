import { clsx } from "clsx";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

/** タブの 1 つ。closable のタブには閉じるボタンを付ける。 */
export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
  closable?: boolean;
  /** ラベルの左に描く印。`aria-hidden` にする。 */
  icon?: ReactNode;
};

export type TabsProps = {
  /** タブの並びの読み上げる名前。 */
  label: string;
  items: readonly TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** 閉じるボタンか、選んだタブで Delete のキーを押したときに呼ぶ。 */
  onClose?: (id: string) => void;
  /**
   * パネルの形。`padded` は 16px の余白を取り、パネル自身を Tab のキーの順に入れる。
   * `flush` は余白とフォーカスを持たず、中身が自分でフォーカスを受けるときに使う（エディタのエンジン）。
   */
  panel?: "padded" | "flush";
  /**
   * compact は、タブを 32px の高さと 13px の文字、閉じるボタンを 28px、選んだタブの筆の線を 3px にする。
   * コードを動かす画面のエディタのタブに使う（docs/adr/0062-dense-text-and-targets-in-playground.md）。
   */
  density?: "default" | "compact";
};

/**
 * タブと、選んだタブのパネル。WAI-ARIA APG のタブのキーボードの操作に従う。
 * 左右の矢印のキーで隣のタブへ移って選び、Home と End で端へ移る。Tab のキーはパネルへ移る。
 * エディタのファイルのタブのために、閉じるボタンを足している。DADS のタブに無い要素である（packages/ui/DesignDoc.md の「DADS から外れる点」）。
 * 閉じるボタンはマウスで押すためのもので、タブの隣に置き、読み上げと Tab のキーの順から外す。タブの並びの中にタブ以外の操作を置けないためである。
 * 閉じられるタブは、マウスの中ボタンでも閉じる。
 * キーボードと読み上げでは、選んだタブで Delete のキーを押して閉じる。閉じられるタブは `aria-keyshortcuts` でこのキーを示す。
 */
export function Tabs({
  label,
  items,
  selectedId,
  onSelect,
  onClose,
  panel = "padded",
  density = "default",
}: TabsProps) {
  const isCompact = density === "compact";
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  const moveTo = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    onSelect(item.id);
    tabRefs.current.get(item.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, item: TabItem) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => moveTo(index + 1),
      ArrowLeft: () => moveTo(index - 1),
      Home: () => moveTo(0),
      End: () => moveTo(items.length - 1),
      Delete: () => {
        if (item.closable) onClose?.(item.id);
      },
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div className={clsx("flex flex-col", panel === "flush" && "min-h-0 flex-1")}>
      <div
        aria-label={label}
        className={clsx(
          "flex overflow-x-auto border-b",
          isCompact ? "border-border/60" : "border-border",
        )}
        role="tablist"
      >
        {items.map((item, index) => {
          const isSelected = item.id === selected?.id;
          return (
            <div className="relative flex shrink-0 items-center" key={item.id}>
              {isSelected && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    "pointer-events-none absolute inset-x-0 bottom-0 animate-stroke bg-primary stroke-brush forced-fill forced-solid",
                    isCompact ? "h-0.75" : "h-1",
                  )}
                />
              )}
              <button
                aria-controls={`${baseId}-panel-${item.id}`}
                aria-keyshortcuts={item.closable ? "Delete" : undefined}
                aria-selected={isSelected}
                className={clsx(
                  "flex cursor-pointer items-center transition-colors",
                  isCompact ? "focus-visible:focus-ring-inset" : "focus-visible:focus-ring",
                  isCompact ? "h-8 gap-1.5 px-3 text-label-compact" : "h-11 gap-2 px-4 text-label",
                  isSelected ? "text-text" : "text-text-secondary hover:text-text",
                )}
                id={`${baseId}-tab-${item.id}`}
                onAuxClick={(event) => {
                  if (event.button !== 1 || !item.closable) return;
                  event.preventDefault();
                  onClose?.(item.id);
                }}
                onClick={() => onSelect(item.id)}
                // 中ボタンの押下で始まる自動スクロールを止める
                onMouseDown={(event) => {
                  if (event.button === 1 && item.closable) event.preventDefault();
                }}
                onKeyDown={(event) => handleKeyDown(event, index, item)}
                ref={(node) => {
                  if (node) tabRefs.current.set(item.id, node);
                  else tabRefs.current.delete(item.id);
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                {item.icon}
                {item.label}
              </button>
              {item.closable && (
                <button
                  aria-hidden="true"
                  aria-label={`${item.label} を閉じる`}
                  className={clsx(
                    "inline-grid cursor-pointer place-items-center text-text-secondary transition-colors hover:text-text",
                    isCompact ? "focus-visible:focus-ring-inset" : "focus-visible:focus-ring",
                    isCompact ? "size-7 rounded-control-compact" : "size-11 rounded-control",
                  )}
                  onClick={() => onClose?.(item.id)}
                  tabIndex={-1}
                  type="button"
                >
                  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {selected && (
        <div
          aria-labelledby={`${baseId}-tab-${selected.id}`}
          className={
            panel === "padded" ? "p-4 focus-visible:focus-ring" : "flex min-h-0 flex-1 flex-col"
          }
          id={`${baseId}-panel-${selected.id}`}
          role="tabpanel"
          tabIndex={panel === "padded" ? 0 : undefined}
        >
          {selected.content}
        </div>
      )}
    </div>
  );
}
