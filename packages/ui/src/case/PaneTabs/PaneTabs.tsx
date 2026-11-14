import { clsx } from "clsx";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

import type { TabItem } from "../../base/Tabs/Tabs";
import { ToolPaneTabPanel } from "../ToolPane/ToolPane";

/** 切り替えるペインの 1 つ。ペインは閉じないので、`Tabs` のタブと違い閉じるボタンを持たず、印を必ず持つ。 */
export type PaneTabItem = Omit<TabItem, "closable" | "icon"> & {
  /** ラベルの上（`placement` が `top` のときは左）に描く 20px の印。`aria-hidden` にする。 */
  icon: ReactNode;
};

/**
 * タブの並びの置き場。
 * `bottom` は縦の狭い配置の下の帯、`start` は高さの低い配置の左の縦の帯、`top` は記事に埋め込んだときの枠の上の帯である（docs/adr/0072-short-landscape-layout-in-playground.md）。
 */
export type PaneTabsPlacement = "bottom" | "start" | "top";

export type PaneTabsProps = {
  /** タブの並びの読み上げる名前。 */
  label: string;
  items: readonly PaneTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  placement: PaneTabsPlacement;
  /** 地を出さない記事の埋め込みで、帯を浮かせず、ペインとの境に罫を 1 本引く（docs/adr/0073-layered-panes-and-radius-in-playground.md）。 */
  flush?: boolean;
  /** タブの並びの先頭に置く操作（ファイルのドロワーを開くボタン）。タブの並びの外に置く。 */
  leading?: ReactNode;
};

/**
 * 狭い配置で、ペインを 1 つずつ切り替えて出すタブ。WAI-ARIA APG のタブのキーボードの操作に従う。
 * 端末とエディタの状態を保つため、選んでいないペインも描いたまま `hidden` で隠す。
 * 押せる領域は、どの置き場でも 44px 以上にする（TARGET-SIZE）。
 */
export function PaneTabs({
  label,
  items,
  selectedId,
  onSelect,
  placement,
  leading,
  flush = false,
}: PaneTabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const isVertical = placement === "start";

  const moveTo = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    onSelect(item.id);
    tabRefs.current.get(item.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = isVertical ? "ArrowDown" : "ArrowRight";
    const previous = isVertical ? "ArrowUp" : "ArrowLeft";
    const keys: Record<string, () => void> = {
      [next]: () => moveTo(index + 1),
      [previous]: () => moveTo(index - 1),
      Home: () => moveTo(0),
      End: () => moveTo(items.length - 1),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const bar = (
    <div
      className={clsx(
        "flex shrink-0 bg-surface-pane",
        // 下と左の帯は、地の上に浮かせた角の丸い紙にする。枠の上の帯は、ペインの面と続け、下の罫だけで分ける（docs/adr/0073-layered-panes-and-radius-in-playground.md）
        placement === "bottom" && (flush ? "border-t border-border" : "mt-1.5 rounded-sheet"),
        placement === "start" &&
          (flush ? "flex-col border-r border-border" : "mr-1.5 flex-col rounded-sheet"),
        placement === "top" && "items-center border-b border-border",
      )}
    >
      {leading !== undefined && (
        <div
          className={clsx(
            "flex shrink-0 items-center justify-center",
            placement === "start" ? "py-1" : "px-1",
          )}
        >
          {leading}
        </div>
      )}
      <div
        aria-label={label}
        aria-orientation={isVertical ? "vertical" : "horizontal"}
        className={clsx("flex min-w-0", isVertical ? "flex-col" : "flex-1")}
        role="tablist"
      >
        {items.map((item, index) => {
          const isSelected = item.id === selected?.id;
          return (
            <button
              aria-controls={`${baseId}-panel-${item.id}`}
              aria-selected={isSelected}
              className={clsx(
                "relative flex cursor-pointer items-center justify-center transition-colors focus-visible:focus-ring-inset",
                placement === "top"
                  ? "h-11 gap-1.5 px-3 text-label-compact"
                  : "min-h-13 min-w-13 flex-col gap-0.5 px-2 py-1 text-compact",
                placement === "bottom" && "flex-1",
                isSelected ? "text-text" : "text-text-secondary hover:text-text",
              )}
              id={`${baseId}-tab-${item.id}`}
              key={item.id}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              {isSelected && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    "pointer-events-none absolute animate-stroke bg-primary stroke-brush forced-fill forced-solid",
                    placement === "bottom" && "inset-x-3 top-0 h-0.75",
                    placement === "top" && "inset-x-0 bottom-0 h-0.75",
                    placement === "start" && "inset-y-2 left-0 w-0.75",
                  )}
                />
              )}
              <span aria-hidden="true" className="relative flex">
                {item.icon}
              </span>
              <span className={clsx(isSelected && "font-semibold")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={clsx(
        "flex size-full min-h-0 min-w-0",
        placement === "bottom" && "flex-col-reverse",
        placement === "top" && "flex-col",
        placement === "start" && "flex-row",
      )}
    >
      {bar}
      <div className="relative min-h-0 min-w-0 flex-1">
        {items.map((item) => (
          <div
            aria-labelledby={`${baseId}-tab-${item.id}`}
            className="absolute inset-0 flex flex-col"
            hidden={item.id !== selected?.id}
            id={`${baseId}-panel-${item.id}`}
            key={item.id}
            role="tabpanel"
          >
            <ToolPaneTabPanel flush={flush}>{item.content}</ToolPaneTabPanel>
          </div>
        ))}
      </div>
    </div>
  );
}
