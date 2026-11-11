import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./TableOfContents.stories";

const { Default, Reading, ReadToEnd } = composeStories(stories);

const link = (name: string) => screen.getByRole("link", { name });

afterEach(() => {
  history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo(0, 0);
});

describe("TableOfContents", () => {
  it("静的に描いた HTML に、全ての見出しへのリンクがあり、読んでいる見出しの印は無い", () => {
    const html = renderToStaticMarkup(<Default />);
    expect(html).toContain('aria-label="目次"');
    expect(html).toContain('href="#overview"');
    expect(html).toContain('href="#pkce"');
    expect(html).toContain("トークンと引き換える");
    expect(html).not.toContain("aria-current");
  });

  it("h3 の項目は直前の h2 の項目の下のリストに入る。リンクは 44 px 以上の高さで押せる", () => {
    render(<Default />);
    const parent = link("認可のリクエストを送る").closest("li");
    expect(parent).toContainElement(link("state を確かめる"));
    expect(parent).toContainElement(link("PKCE の値を付ける"));
    expect(parent).not.toContainElement(link("トークンと引き換える"));
    for (const element of screen.getAllByRole("link")) {
      expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it("ページに見出しが無ければ、どのリンクにも aria-current を付けない", () => {
    render(<Default />);
    for (const element of screen.getAllByRole("link")) {
      expect(element).not.toHaveAttribute("aria-current");
    }
  });

  it("項目を押すと対応する見出しへ移り、そのリンクに aria-current=location を付ける", async () => {
    render(<Reading />);
    await userEvent.click(link("トークンと引き換える"));
    expect(location.hash).toBe("#token");
    const heading = screen.getByRole("heading", { name: "トークンと引き換える" });
    expect(Math.abs(heading.getBoundingClientRect().top)).toBeLessThan(1);
    await expect
      .poll(() => link("トークンと引き換える").getAttribute("aria-current"))
      .toBe("location");
    expect(link("PKCE の値を付ける")).not.toHaveAttribute("aria-current");
  });

  it("読んでいる見出しのリンクは、current-page の色の文字と左の線で示す", async () => {
    render(
      <>
        <Reading />
        <span className="text-current-page" data-testid="current-page" />
      </>,
    );
    await userEvent.click(link("トークンと引き換える"));
    await expect
      .poll(() => link("トークンと引き換える").getAttribute("aria-current"))
      .toBe("location");
    const expected = getComputedStyle(screen.getByTestId("current-page")).color;
    const current = getComputedStyle(link("トークンと引き換える"));
    expect(current.color).toBe(expected);
    expect(current.borderLeftColor).toBe(expected);
    expect(getComputedStyle(link("PKCE の値を付ける")).color).not.toBe(expected);
  });

  it("見出しを一度に飛び越えて移っても、読んでいる見出しが追う", async () => {
    render(<Reading />);
    window.scrollTo(0, window.innerHeight * 1.5);
    await expect
      .poll(() => link("認可のリクエストを送る").getAttribute("aria-current"))
      .toBe("location");
    window.scrollTo(0, window.innerHeight * 4.5);
    await expect
      .poll(() => link("トークンと引き換える").getAttribute("aria-current"))
      .toBe("location");
  });

  it("上へ戻ると、読んでいる見出しも戻る", async () => {
    render(<Reading />);
    screen.getByRole("heading", { name: "PKCE の値を付ける" }).scrollIntoView();
    await expect
      .poll(() => link("PKCE の値を付ける").getAttribute("aria-current"))
      .toBe("location");
    screen.getByRole("heading", { name: "state を確かめる" }).scrollIntoView();
    await expect.poll(() => link("state を確かめる").getAttribute("aria-current")).toBe("location");
    expect(
      screen.getAllByRole("link").filter((el) => el.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("最後の節が短くても、末尾までスクロールすると最後の見出しを読んでいる見出しにし、離れると戻す", async () => {
    render(<ReadToEnd />);
    screen.getByRole("heading", { name: "トークンと引き換える" }).scrollIntoView();
    await expect
      .poll(() => link("トークンと引き換える").getAttribute("aria-current"))
      .toBe("location");
    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect.poll(() => link("まとめ").getAttribute("aria-current")).toBe("location");
    expect(link("トークンと引き換える")).not.toHaveAttribute("aria-current");
    window.scrollBy(0, -window.innerHeight * 0.1);
    await expect
      .poll(() => link("トークンと引き換える").getAttribute("aria-current"))
      .toBe("location");
  });
});
