import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Link.stories";

const { Default, Wrapped, Standalone, LargeTarget, External } = composeStories(stories);

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

  it("文中でないリンクは左右を空けず、フォーカスの表示を隣の日付に重ねない", async () => {
    render(<Standalone />);
    const link = screen.getByRole("link", { name: "認可コードフローの記事" });
    const style = getComputedStyle(link);
    expect(style.marginLeft).toBe("0px");
    expect(style.marginRight).toBe("0px");
    await userEvent.tab();
    expect(link).toHaveFocus();
    const focused = getComputedStyle(link);
    const extent =
      Number.parseFloat(focused.outlineOffset) + Number.parseFloat(focused.outlineWidth);
    const date = screen.getByText("2026-11-13");
    expect(link.getBoundingClientRect().right + extent).toBeLessThanOrEqual(
      date.getBoundingClientRect().left,
    );
  });

  it("押せる領域を広げたリンクは、44×44 px 以上を押せる", () => {
    render(<LargeTarget>開く</LargeTarget>);
    const box = screen.getByRole("link", { name: "開く" }).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  it("押せる領域を広げたリンクを hover すると、箱の下端ではなく下線の下に 2px の罫を引く", async () => {
    render(<LargeTarget />);
    const link = screen.getByRole("link", { name: "Go" });
    const text = screen.getByText("Go");
    expect(text).not.toBe(link);
    expect(getComputedStyle(link).backgroundImage).toBe("none");
    expect(getComputedStyle(text).textDecorationLine).toBe("underline");
    expect(text.getBoundingClientRect().bottom).toBeLessThan(link.getBoundingClientRect().bottom);
    await userEvent.hover(link);
    await expect.poll(() => getComputedStyle(text).backgroundSize).toBe("100% 2px");
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
