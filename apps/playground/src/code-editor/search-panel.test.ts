// @vitest-environment jsdom
import {
  SearchQuery,
  getSearchQuery,
  openSearchPanel,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { codeEditorExtensions } from "./extensions";

const views: EditorView[] = [];

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
});

const open = (doc: string) => {
  const view = new EditorView({
    doc,
    parent: document.body,
    extensions: codeEditorExtensions({ label: "SQL" }),
  });
  views.push(view);
  openSearchPanel(view);
  const panel = view.dom.querySelector<HTMLElement>(".cm-search");
  if (!panel) throw new Error("検索パネルが無い");
  const field = (name: string) => panel.querySelector<HTMLInputElement>(`input[name=${name}]`);
  const press = (text: string) => {
    const found = [...panel.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === text,
    );
    if (!found) throw new Error(`ボタン「${text}」が無い`);
    return found;
  };
  const type = (input: HTMLInputElement | null, value: string) => {
    if (!input) throw new Error("入力欄が無い");
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  const key = (target: HTMLElement | null, init: KeyboardEventInit) =>
    target?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  return { view, panel, field, press, type, key };
};

describe("createSearchPanel", () => {
  it("開いたら、検索の欄にフォーカスを移す", () => {
    const { field } = open("select 1;");
    expect(document.activeElement).toBe(field("search"));
  });

  it("置換の行を、最初は畳んで出す", () => {
    const { field } = open("select 1;");
    expect(field("replace")?.closest<HTMLElement>(".cm-search-row")?.hidden).toBe(true);
  });

  it("置換を開くボタンで、置換の行を開き、もう一度押すと畳む", () => {
    const { field, press } = open("select 1;");
    press("置換を開く").click();
    const opened = field("replace")?.closest<HTMLElement>(".cm-search-row")?.hidden;
    press("置換を閉じる").click();
    const closed = field("replace")?.closest<HTMLElement>(".cm-search-row")?.hidden;
    expect({ opened, closed }).toStrictEqual({ opened: false, closed: true });
  });

  it("検索の欄と切り替えで、検索の条件を変える", () => {
    const { view, field, type, panel } = open("Select select;");
    type(field("search"), "select");
    panel.querySelector<HTMLButtonElement>("[data-toggle=caseSensitive]")?.click();
    const query = getSearchQuery(view.state);
    expect({ search: query.search, caseSensitive: query.caseSensitive }).toStrictEqual({
      search: "select",
      caseSensitive: true,
    });
  });

  it("切り替えの押された状態を、aria-pressed で示す", () => {
    const { panel } = open("x");
    const toggle = panel.querySelector<HTMLButtonElement>("[data-toggle=regexp]");
    toggle?.click();
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
  });

  it("すべて置換で、一致を全て置き換える", () => {
    const { view, field, type, press } = open("orders, orders");
    type(field("search"), "orders");
    type(field("replace"), "users");
    press("すべて置換").click();
    expect(view.state.doc.toString()).toBe("users, users");
  });

  it("検索の欄で Enter を押すと、次の一致を選ぶ", () => {
    const { view, field, type, key } = open("a b a");
    type(field("search"), "a");
    key(field("search"), { key: "Enter" });
    key(field("search"), { key: "Enter" });
    const { from, to } = view.state.selection.main;
    expect({ from, to }).toStrictEqual({ from: 4, to: 5 });
  });

  it("検索の欄で Shift と Enter を押すと、前の一致を選ぶ", () => {
    const { view, field, type, key } = open("a b a");
    type(field("search"), "a");
    key(field("search"), { key: "Enter" });
    key(field("search"), { key: "Enter" });
    key(field("search"), { key: "Enter", shiftKey: true });
    const { from, to } = view.state.selection.main;
    expect({ from, to }).toStrictEqual({ from: 0, to: 1 });
  });

  it("外から検索の条件が変わったら、欄と切り替えを描き直す", () => {
    const { view, field, panel } = open("a");
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "b", regexp: true })) });
    expect({
      search: field("search")?.value,
      regexp: panel.querySelector("[data-toggle=regexp]")?.getAttribute("aria-pressed"),
    }).toStrictEqual({ search: "b", regexp: "true" });
  });

  it("置換を開くと、aria-expanded を true にし、置換の欄にフォーカスを移す", () => {
    const { field, press } = open("a");
    const button = press("置換を開く");
    button.click();
    expect({
      expanded: button.getAttribute("aria-expanded"),
      focused: document.activeElement === field("replace"),
    }).toStrictEqual({ expanded: "true", focused: true });
  });

  it("置換の欄で Enter を押すと、今の一致を置き換える", () => {
    const { view, field, type, key } = open("a b");
    type(field("search"), "a");
    type(field("replace"), "c");
    key(field("search"), { key: "Enter", shiftKey: true });
    key(field("replace"), { key: "Enter" });
    expect(view.state.doc.toString()).toBe("c b");
  });

  it("Esc でパネルを閉じる", () => {
    const { view, field, key } = open("a");
    key(field("search"), { key: "Escape" });
    expect(searchPanelOpen(view.state)).toBe(false);
  });

  it("閉じるボタンでパネルを閉じる", () => {
    const { view, panel } = open("a");
    panel.querySelector<HTMLButtonElement>("[name=close]")?.click();
    expect(searchPanelOpen(view.state)).toBe(false);
  });

  it("前へと次へのボタンで、一致の間を移る", () => {
    const { view, field, type, press } = open("a b a");
    type(field("search"), "a");
    press("次へ").click();
    press("次へ").click();
    press("前へ").click();
    const { from, to } = view.state.selection.main;
    expect({ from, to }).toStrictEqual({ from: 0, to: 1 });
  });

  it("置換のボタンで、今の一致を置き換える", () => {
    const { view, field, type, press } = open("a b");
    type(field("search"), "a");
    type(field("replace"), "c");
    press("前へ").click();
    press("置換").click();
    expect(view.state.doc.toString()).toBe("c b");
  });

  it("同じ文字を入れ直しても、検索の条件を作り直さない", () => {
    const { view, field, type } = open("a");
    type(field("search"), "a");
    const before = getSearchQuery(view.state);
    type(field("search"), "a");
    expect(getSearchQuery(view.state)).toBe(before);
  });
});
