import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./SearchBox.stories";

const { Empty, WithSuggestions, NoSuggestions } = composeStories(stories);

const option = (name: string) => screen.getByRole("option", { name });

afterEach(() => {
  history.replaceState(null, "", location.pathname + location.search);
});

describe("SearchBox", () => {
  it("静的に描いた HTML は、GET で語を送る search の form で、欄に名前と見出しがある", () => {
    const html = renderToStaticMarkup(<Empty />);
    expect(html).toContain('role="search"');
    expect(html).toContain('action="#search"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain("記事を検索");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>.*検索.*<\/button>/);
  });

  it("欄の見出しは読み上げにだけ渡し、画面に出さない。欄は下の 1 辺だけに枠を引く", () => {
    render(<Empty />);
    const input = screen.getByRole("combobox", { name: "記事を検索" });
    expect(screen.getByText("記事を検索").getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(input).borderTopWidth).toBe("0px");
    expect(getComputedStyle(input).borderBottomWidth).toBe("1px");
  });

  it("「検索」のボタンは 44 px 以上の高さで、押すと form を送る", async () => {
    render(<Empty />);
    const submitted = vi.fn((event: SubmitEvent) => event.preventDefault());
    screen.getByRole("search").addEventListener("submit", submitted);
    const button = screen.getByRole("button", { name: "検索" });
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(button);
    expect(submitted).toHaveBeenCalledOnce();
  });

  it("候補があっても、欄にフォーカスするまでは一覧を開かない", async () => {
    render(<WithSuggestions />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.click(input);
    expect(screen.getByRole("listbox")).toBeVisible();
  });

  it("語を入れたのに候補が 0 件なら、live の領域に emptyMessage の文を入れる", async () => {
    const { container } = render(<NoSuggestions />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("");
    await userEvent.click(screen.getByRole("combobox"));
    expect(live).toHaveTextContent("合う記事がありません");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("emptyMessage を渡さなければ、候補が 0 件でも live の領域は空のままにする", async () => {
    const { container } = render(<NoSuggestions emptyMessage={undefined} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("");
  });

  it("候補が無ければ閉じていて、欄は 44 px 以上の高さで押せる。語を変えると外に知らせる", async () => {
    render(<Empty />);
    const input = screen.getByRole("combobox", { name: "記事を検索" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.type(input, "pkce");
    expect(Empty.args.onQueryChange).toHaveBeenLastCalledWith("pkce");
  });

  it("下と上の矢印のキーで候補の間を移り、端から反対の端へ回る。フォーカスは欄に残す", async () => {
    render(<WithSuggestions />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await userEvent.keyboard("{ArrowDown}");
    const first = option("認可コードフローを手で追う");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", option("リフレッシュトークンを回す").id);
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
  });

  it("Enter のキーで選んだ候補の href へ移る", async () => {
    render(<WithSuggestions />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(location.hash).toBe("#pkce");
  });

  it("候補を選んでいないときの Enter のキーは、form を送る", async () => {
    render(<WithSuggestions />);
    const submitted = vi.fn((event: SubmitEvent) => event.preventDefault());
    const form = screen.getByRole("search");
    form.addEventListener("submit", submitted);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Enter}");
    expect(submitted).toHaveBeenCalledOnce();
    expect(location.hash).toBe("");
  });

  it("Esc のキーで候補を閉じ、下の矢印のキーで開き直して最初の候補を選ぶ", async () => {
    render(<WithSuggestions />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-activedescendant", option("認可コードフローを手で追う").id);
  });

  it("候補は 44 px 以上の高さで、押すとその href へ移る", async () => {
    render(<WithSuggestions />);
    await userEvent.click(screen.getByRole("combobox"));
    for (const element of screen.getAllByRole("option")) {
      expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    await userEvent.click(option("リフレッシュトークンを回す"));
    expect(location.hash).toBe("#refresh-token");
  });
});
