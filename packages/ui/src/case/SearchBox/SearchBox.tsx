import { clsx } from "clsx";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { TextField } from "../../base/TextField/TextField";

/** 検索の候補の 1 件。選ぶと href へ移る。 */
export type SearchSuggestion = {
  label: string;
  href: string;
};

export type SearchBoxProps = {
  /** 欄の見出し。 */
  label: string;
  /** 語を送る先。JavaScript が無くても、`<form method="get">` でこの URL に語を送る。 */
  action: string;
  /** 語を送るときのクエリの名前。 */
  name?: string;
  defaultQuery?: string;
  /** 欄の下に出す候補。語から候補を探すのは呼び出す側が担う。 */
  suggestions: readonly SearchSuggestion[];
  /** 欄の語が変わるたびに呼ぶ。 */
  onQueryChange?: (query: string) => void;
};

/**
 * 記事の検索の語の欄と候補。WAI-ARIA APG の Combobox（list autocomplete）のキーボードの操作に従う。
 * 下と上の矢印のキーで候補の間を移り、端から反対の端へ回る。Enter のキーで選んだ候補へ移り、Esc のキーで候補を閉じる。
 * フォーカスは欄に置いたまま、選んだ候補を `aria-activedescendant` で示す。
 * 候補を選んでいないときの Enter のキーは、form の送信に任せる。
 */
export function SearchBox({
  label,
  action,
  name = "q",
  defaultQuery,
  suggestions,
  onQueryChange,
}: SearchBoxProps) {
  const listboxId = useId();
  const optionRefs = useRef<HTMLAnchorElement[]>([]);
  const [isDismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previousSuggestions, setPreviousSuggestions] = useState(suggestions);
  if (previousSuggestions !== suggestions) {
    setPreviousSuggestions(suggestions);
    setActiveIndex(-1);
  }
  const isOpen = !isDismissed && suggestions.length > 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const close = () => {
    setDismissed(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // かなの変換を確かめる Enter と矢印のキーを、候補の操作にしない
    if (event.nativeEvent.isComposing) return;
    const count = suggestions.length;
    const keys: Record<string, () => boolean> = {
      ArrowDown: () => {
        if (count === 0) return false;
        setDismissed(false);
        setActiveIndex(isOpen ? (activeIndex + 1) % count : 0);
        return true;
      },
      ArrowUp: () => {
        if (count === 0) return false;
        setDismissed(false);
        setActiveIndex(isOpen && activeIndex > 0 ? activeIndex - 1 : count - 1);
        return true;
      },
      Enter: () => {
        if (!isOpen || activeIndex < 0) return false;
        optionRefs.current[activeIndex]?.click();
        return true;
      },
      Escape: () => {
        if (!isOpen) return false;
        close();
        return true;
      },
    };
    if (keys[event.key]?.()) event.preventDefault();
  };

  return (
    <form action={action} method="get" role="search">
      <div className="relative">
        <TextField
          aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          autoComplete="off"
          defaultValue={defaultQuery}
          enterKeyHint="search"
          label={label}
          name={name}
          onBlur={close}
          onChange={(event) => {
            setDismissed(false);
            setActiveIndex(-1);
            onQueryChange?.(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          type="text"
        />
        {isOpen && (
          <div
            aria-label={`${label}の候補`}
            className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-md bg-surface-raised py-1 shadow-2"
            id={listboxId}
            // 候補を押す間に欄からフォーカスが外れると、blur で候補が閉じて押せなくなる
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <a
                aria-selected={index === activeIndex}
                className={clsx(
                  "flex min-h-11 items-center px-4 text-body-dense text-text hover:bg-surface-subtle",
                  "aria-selected:bg-primary-surface aria-selected:font-bold",
                )}
                href={suggestion.href}
                id={optionId(index)}
                key={suggestion.href}
                ref={(node) => {
                  if (node) optionRefs.current[index] = node;
                }}
                role="option"
                tabIndex={-1}
              >
                {suggestion.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
