import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Table.stories";

const { Default, Wide, Compact } = composeStories(stories);

describe("Table", () => {
  it("静的に描いた HTML に、題と見出しとセルの文字がある", () => {
    const html = renderToStaticMarkup(<Default />);
    expect(html).toContain("<table");
    expect(html).toContain("レスポンスのヘッダ");
    expect(html).toContain("cache-control");
    expect(html).toContain("no-store");
  });

  it("題を表の名前にし、行の見出しのセルを行の見出しとして読む", () => {
    render(<Default />);
    expect(screen.getByRole("table", { name: "レスポンスのヘッダ" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "cache-control" })).toBeInTheDocument();
  });

  it("幅に収まらない表は、Tab のキーで枠にフォーカスし、右の矢印のキーで横に送れる", async () => {
    render(<Wide />);
    const region = screen.getByRole("region", { name: "SQL の結果" });
    expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
    await userEvent.tab();
    expect(region).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => region.scrollLeft).toBeGreaterThan(0);
  });

  it("density を compact にすると、セルの余白は上下 2px と左右 8px、文字は 13 px になる（ADR-0062）", () => {
    render(<Compact />);
    for (const cell of document.querySelectorAll("th, td")) {
      const style = getComputedStyle(cell);
      expect(style.paddingTop).toBe("2px");
      expect(style.paddingLeft).toBe("8px");
      expect(style.fontSize).toBe("13px");
    }
  });
});
