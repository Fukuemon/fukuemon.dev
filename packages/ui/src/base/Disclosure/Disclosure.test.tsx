import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Disclosure.stories";

const { Closed } = composeStories(stories);

describe("Disclosure", () => {
  it("静的に描いた HTML に、要約と中身の文字がある", () => {
    const html = renderToStaticMarkup(<Closed />);
    expect(html).toContain("<details");
    expect(html).toContain("認可コードを 1 回だけ使える理由");
    expect(html).toContain("盗んだ側はトークンに替えられない");
  });

  it("React を動かさずに置いた静的な HTML でも、要約を押すと中身が見える", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<Closed />);
    document.body.append(container);
    const summary = container.querySelector("summary")!;
    const content = container.querySelector("details > div")!;
    expect(content.checkVisibility()).toBe(false);
    await userEvent.click(summary);
    expect(content.checkVisibility()).toBe(true);
    container.remove();
  });

  it("要約はボタンとして読め、Enter のキーで開き、44 px の高さで押せる", async () => {
    render(<Closed />);
    const summary = screen.getByText("認可コードを 1 回だけ使える理由");
    expect(summary.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.tab();
    expect(summary).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(summary.closest("details")).toHaveAttribute("open");
  });
});
