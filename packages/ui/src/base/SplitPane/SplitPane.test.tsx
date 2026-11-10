import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./SplitPane.stories";

const { Horizontal, Vertical } = composeStories(stories);

const widths = () => ({
  primary: screen.getByText("エディタ").parentElement!.getBoundingClientRect().width,
  secondary: screen.getByText("プレビュー").parentElement!.getBoundingClientRect().width,
});

describe("SplitPane", () => {
  it("左右の矢印のキーで仕切りが動き、両側の領域の幅が変わる", async () => {
    render(<Horizontal />);
    const separator = screen.getByRole("separator", { name: "エディタとプレビューの境界" });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    await userEvent.tab();
    expect(separator).toHaveFocus();
    const before = widths();
    await userEvent.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "55");
    const after = widths();
    expect(after.primary).toBeGreaterThan(before.primary);
    expect(after.secondary).toBeLessThan(before.secondary);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(separator).toHaveAttribute("aria-valuenow", "45");
    expect(widths().primary).toBeLessThan(before.primary);
  });

  it("Home と End で最小と最大へ動き、その外へは動かない", async () => {
    render(<Horizontal />);
    const separator = screen.getByRole("separator");
    await userEvent.tab();
    await userEvent.keyboard("{End}{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "80");
    await userEvent.keyboard("{Home}{ArrowLeft}");
    expect(separator).toHaveAttribute("aria-valuenow", "20");
  });

  it("上下に並べたときは、上下の矢印のキーで動き、左右の矢印のキーでは動かない", async () => {
    render(<Vertical />);
    const separator = screen.getByRole("separator", { name: "エディタと端末の境界" });
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "70");
    await userEvent.keyboard("{ArrowUp}");
    expect(separator).toHaveAttribute("aria-valuenow", "65");
  });

  it("仕切りは 44 px の幅で押せ、引くと動く", async () => {
    render(<Horizontal />);
    const separator = screen.getByRole("separator");
    const rect = separator.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    const root = separator.parentElement!.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const x = rect.left + rect.width / 2;
    separator.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y }),
    );
    separator.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: root.left + root.width * 0.3,
        clientY: y,
      }),
    );
    await expect.poll(() => separator.getAttribute("aria-valuenow")).toBe("30");
  });
});
