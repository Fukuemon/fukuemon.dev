import { clsx } from "clsx";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { Button } from "../../base/Button/Button";
import { TextField } from "../../base/TextField/TextField";

/** 検索の候補の 1 件。選ぶと url へ移る。Pagefind の結果の title と url の名前に合わせる。 */
export type SearchSuggestion = {
  title: string;
  url: string;
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
  /** 語を入れたのに候補が 0 件のとき、`aria-live="polite"` の領域で知らせる文。渡さなければ何も知らせない。 */
  emptyMessage?: string;
};

/**
 * 記事の検索の語の欄と候補。WAI-ARIA APG の Combobox（list autocomplete）のキーボードの操作に従う。
 * 下と上の矢印のキーで候補の間を移り、端から反対の端へ回る。Enter のキーで選んだ候補へ移り、Esc のキーで候補を閉じる。
 * フォーカスは欄に置いたまま、選んだ候補を `aria-activedescendant` で示す。
 * 候補を選んでいないときの Enter のキーと「検索」のボタンは、form の送信に任せる。
 * 候補の一覧は、欄にフォーカスがある間だけ開く。
 */
export function SearchBox({
  label,
  action,
  name = "q",
  defaultQuery,
  suggestions,
  onQueryChange,
  emptyMessage,
}: SearchBoxProps) {
  const listboxId = useId();
  const optionRefs = useRef<HTMLAnchorElement[]>([]);
  const [isFocused, setFocused] = useState(false);
  const [isDismissed, setDismissed] = useState(false);
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previousSuggestions, setPreviousSuggestions] = useState(suggestions);
  if (previousSuggestions !== suggestions) {
    setPreviousSuggestions(suggestions);
    setActiveIndex(-1);
  }
  const isOpen = isFocused && !isDismissed && suggestions.length > 0;
  const isEmpty = isFocused && query.trim() !== "" && suggestions.length === 0;
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
    <form action={action} className="flex items-end gap-2" method="get" role="search">
      <div className="relative min-w-0 flex-1">
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
          onBlur={() => {
            setFocused(false);
            close();
          }}
          onChange={(event) => {
            setDismissed(false);
            setActiveIndex(-1);
            setQuery(event.target.value);
            onQueryChange?.(event.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            setDismissed(false);
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
                href={suggestion.url}
                id={optionId(index)}
                key={suggestion.url}
                ref={(node) => {
                  if (node) optionRefs.current[index] = node;
                }}
                role="option"
                tabIndex={-1}
              >
                {suggestion.title}
              </a>
            ))}
          </div>
        )}
        {/* 中身を変える前から置いておかないと、読み上げの道具が変化を拾わない */}
        <p
          aria-live="polite"
          className="absolute inset-x-0 top-full z-10 mt-1 rounded-md bg-surface-raised px-4 py-3 text-body-dense text-text-secondary shadow-2 empty:hidden"
        >
          {isEmpty ? emptyMessage : undefined}
        </p>
      </div>
      <Button type="submit" variant="secondary">
        検索
      </Button>
    </form>
  );
}
