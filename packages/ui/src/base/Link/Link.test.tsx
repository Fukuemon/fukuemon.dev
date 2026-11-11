import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Link.stories";

const { Default, External } = composeStories(stories);

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
});
