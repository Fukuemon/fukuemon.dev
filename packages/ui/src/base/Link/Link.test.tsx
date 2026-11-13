import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Link.stories";

const { Default, Wrapped, External } = composeStories(stories);

const colorOf = (className: string) => {
  render(<span className={className} data-testid={className} />);
  return getComputedStyle(screen.getByTestId(className)).color;
};

describe("Link", () => {
  it("内部のリンクは link の色で、同じタブで開く", () => {
    render(<Default />);
    const link = screen.getByRole("link", { name: "認可コードフローの記事" });
    expect(link).not.toHaveAttribute("target");
    expect(getComputedStyle(link).color).toBe(colorOf("text-link"));
  });

  it("外部のリンクは link-external の色で新しいタブで開き、そのことを名前で伝える", () => {
    render(<External />);
    const link = screen.getByRole("link", { name: /^DADS\s*（新しいタブで開く）$/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(getComputedStyle(link).color).toBe(colorOf("text-link-external"));
    expect(getComputedStyle(link).color).not.toBe(colorOf("text-link"));
  });

  it("フォーカスの表示が外へ広がる幅だけ左右を空け、前後の文字に重ねない", async () => {
    render(<Default />);
    const link = screen.getByRole("link", { name: "認可コードフローの記事" });
    await userEvent.tab();
    expect(link).toHaveFocus();
    const style = getComputedStyle(link);
    const extent = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth);
    expect(extent).toBeGreaterThan(0);
    expect(Number.parseFloat(style.marginLeft)).toBeGreaterThanOrEqual(extent);
    expect(Number.parseFloat(style.marginRight)).toBeGreaterThanOrEqual(extent);
  });

  it("hover すると、折り返したリンクのどの行にも 2px の罫を引く", async () => {
    render(<Wrapped />);
    const link = screen.getByRole("link", { name: /認可コードフロー/ });
    expect(link.getClientRects().length).toBeGreaterThan(1);
    expect(getComputedStyle(link).backgroundSize).toBe("0% 2px");
    await userEvent.hover(link);
    await expect.poll(() => getComputedStyle(link).backgroundSize).toBe("100% 2px");
  });
});
