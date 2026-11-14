import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Table.stories";

const { Default, Wide } = composeStories(stories);

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

  describe("右端のぼかし", () => {
    const fadeOpacity = (el: HTMLElement) => Number(getComputedStyle(el, "::after").opacity);

    it("幅に収まる表には出さない", async () => {
      render(<Default />);
      const region = screen.getByRole("region", { name: "レスポンスのヘッダ" });
      await expect.poll(() => fadeOpacity(region)).toBe(0);
    });

    it("幅に収まらない表には、送る前に出し、右端まで送ると消す", async () => {
      render(<Wide />);
      const region = screen.getByRole("region", { name: "SQL の結果" });
      await expect.poll(() => fadeOpacity(region)).toBe(1);
      region.scrollLeft = region.scrollWidth - region.clientWidth;
      await expect.poll(() => fadeOpacity(region)).toBe(0);
    });
  });
});
