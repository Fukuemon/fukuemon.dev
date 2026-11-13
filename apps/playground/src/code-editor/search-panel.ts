import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from "@codemirror/search";
import { type EditorView, type Panel, type ViewUpdate, runScopeHandlers } from "@codemirror/view";

type Toggle = "caseSensitive" | "regexp" | "wholeWord";

const TOGGLES: readonly { key: Toggle; text: string; label: string }[] = [
  { key: "caseSensitive", text: "Aa", label: "大文字と小文字を区別" },
  { key: "regexp", text: ".*", label: "正規表現" },
  { key: "wholeWord", text: "単語", label: "単語で探す" },
];

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function button(text: string, attributes: Record<string, string>, onClick: () => void) {
  const node = element("button", { type: "button", class: "cm-button", ...attributes }, text);
  node.addEventListener("click", onClick);
  return node;
}

/**
 * 検索と置換のパネル。1 行目に検索の欄と、前へ、次へ、3 つの切り替え、置換の行の開閉、閉じるを並べる。
 * 置換の行は最初は畳み、置換を開くボタンで開く。狭い幅でもエディタの行が見えるようにするためである。
 * Enter で次へ、Shift と Enter で前へ、Esc でパネルを閉じてエディタに戻る。
 */
export function createSearchPanel(view: EditorView): Panel {
  let query = getSearchQuery(view.state);
  const search = element("input", {
    class: "cm-textfield",
    name: "search",
    "aria-label": "検索",
    placeholder: "検索",
    "main-field": "true",
  });
  const replace = element("input", {
    class: "cm-textfield",
    name: "replace",
    "aria-label": "置換",
    placeholder: "置換",
  });
  const toggles = TOGGLES.map(({ key, text, label }) =>
    button(
      text,
      { "aria-label": label, title: label, "aria-pressed": "false", "data-toggle": key },
      () => commit({ [key]: !query[key] }),
    ),
  );
  const replaceRow = element(
    "div",
    { class: "cm-search-row", hidden: "" },
    replace,
    button("置換", {}, () => replaceNext(view)),
    button("すべて置換", {}, () => replaceAll(view)),
  );
  const expand = button("置換を開く", { "aria-expanded": "false" }, () => {
    const open = replaceRow.hidden;
    replaceRow.hidden = !open;
    expand.setAttribute("aria-expanded", String(open));
    expand.textContent = open ? "置換を閉じる" : "置換を開く";
    if (open) replace.focus();
  });

  const showToggles = () => {
    for (const node of toggles) {
      node.setAttribute("aria-pressed", String(query[node.dataset.toggle as Toggle]));
    }
  };
  const show = () => {
    search.value = query.search;
    replace.value = query.replace;
    showToggles();
  };

  function commit(change: Partial<Pick<SearchQuery, "search" | "replace" | Toggle>>) {
    const next = new SearchQuery({
      search: change.search ?? query.search,
      replace: change.replace ?? query.replace,
      caseSensitive: change.caseSensitive ?? query.caseSensitive,
      regexp: change.regexp ?? query.regexp,
      wholeWord: change.wholeWord ?? query.wholeWord,
    });
    if (next.eq(query)) return;
    query = next;
    showToggles();
    view.dispatch({ effects: setSearchQuery.of(next) });
  }

  search.addEventListener("input", () => commit({ search: search.value }));
  replace.addEventListener("input", () => commit({ replace: replace.value }));
  const onKey = (event: KeyboardEvent) => {
    // パネルの中でも、検索の keymap（Esc、Ctrl か ⌘ と G、F3 など）を効かせる。CodeMirror の既定のパネルと同じである
    if (runScopeHandlers(view, event, "search-panel")) {
      event.preventDefault();
    } else if (event.key === "Enter" && event.target === search) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(view);
    } else if (event.key === "Enter" && event.target === replace) {
      event.preventDefault();
      replaceNext(view);
    }
  };

  const dom = element(
    "div",
    { class: "cm-search", role: "search", "aria-label": "検索と置換" },
    element(
      "div",
      { class: "cm-search-row" },
      search,
      button("前へ", {}, () => findPrevious(view)),
      button("次へ", {}, () => findNext(view)),
      ...toggles,
      expand,
      button("×", { "aria-label": "閉じる", name: "close" }, () => {
        closeSearchPanel(view);
        view.focus();
      }),
    ),
    replaceRow,
  );
  dom.addEventListener("keydown", onKey);
  show();

  return {
    dom,
    top: true,
    // パネルを開いたら、検索の欄にフォーカスを移す。CodeMirror の既定のパネルと同じ振る舞いにする
    mount() {
      search.focus();
      search.select();
    },
    update(update: ViewUpdate) {
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(setSearchQuery) && !effect.value.eq(query)) {
            query = effect.value;
            show();
          }
        }
      }
    },
  };
}
