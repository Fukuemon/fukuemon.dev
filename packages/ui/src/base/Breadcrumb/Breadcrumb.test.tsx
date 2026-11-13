import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Breadcrumb.stories";

const { Default, LongLabel } = composeStories(stories);

describe("Breadcrumb", () => {
  it("静的に描いた HTML に、全ての階層の文字とリンクがある", () => {
    const html = renderToStaticMarkup(<Default />);
    expect(html).toContain('href="#articles"');
    expect(html).toContain("記事");
    expect(html).toContain("OAuth を手で追う");
    expect(html).toContain("認可コードフロー");
  });

  it("最後の項目は今のページで、リンクにしない。リンクは 44 px 四方以上で押せる", () => {
    render(<Default />);
    const nav = screen.getByRole("navigation", { name: "パンくずリスト" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("認可コードフロー")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "認可コードフロー" })).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      const rect = link.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });

  it("リンクを hover すると、箱の下に箱の幅の筆の線を引く。ラベルが折り返しても線は 1 本である", async () => {
    render(<LongLabel />);
    const target = screen.getByRole("link", { name: /OpenID Connect/ });
    const range = document.createRange();
    range.selectNodeContents(target);
    const lineTops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
    expect(lineTops.size).toBeGreaterThan(1);
    const brush = () => getComputedStyle(target, "::after");
    expect(brush().maskImage).not.toBe("none");
    expect(brush().clipPath).toBe("inset(0px 100% 0px 0px)");
    expect(Number.parseFloat(brush().width)).toBeCloseTo(target.getBoundingClientRect().width, 1);
    await userEvent.hover(target);
    await expect.poll(() => brush().clipPath).toBe("inset(0px)");
  });
});
