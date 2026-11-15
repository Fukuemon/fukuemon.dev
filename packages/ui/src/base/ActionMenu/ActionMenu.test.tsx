import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { fn } from "storybook/test";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./ActionMenu.stories";

const { Closed, Compact } = composeStories(stories);

describe("ActionMenu", () => {
  it("開くと最初の項目へフォーカスを移し、上下の矢印のキーで項目の間を回る", async () => {
    render(<Closed />);
    const button = screen.getByRole("button", { name: "記録の操作" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(items[2]).toHaveFocus();
  });

  it("Esc のキーで閉じ、開くボタンにフォーカスを戻す", async () => {
    render(<Closed />);
    const button = screen.getByRole("button", { name: "記録の操作" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("項目を Enter で選ぶと onSelect を呼んで閉じる。メニューの外を押しても閉じる", async () => {
    const onSelect = fn();
    render(<Closed items={[{ id: "copy", label: "コピーする", onSelect }]} />);
    const button = screen.getByRole("button", { name: "記録の操作" });
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(button);
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("開くボタンと項目は 44 px 以上の大きさで押せる", async () => {
    render(<Closed />);
    const button = screen.getByRole("button", { name: "記録の操作" });
    const rect = button.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    await userEvent.click(button);
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it("density を compact にすると、ボタンと項目を 28 px、項目の文字を 13 px にする（ADR-0062）", async () => {
    render(<Compact />);
    const button = screen.getByRole("button");
    expect(button.getBoundingClientRect().height).toBe(28);
    await userEvent.click(button);
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(28);
      expect(getComputedStyle(item).fontSize).toBe("13px");
    }
  });

  it.each([
    ["light", "default"],
    ["dark", "default"],
    ["light", "compact"],
    ["dark", "compact"],
  ] as const)(
    "%s の %s で項目に hover すると、背景がメニューの面と違う surface-raised-subtle の色になる",
    async (theme, density) => {
      document.documentElement.dataset.theme = theme;
      try {
        render(
          <>
            <span className="bg-surface-raised-subtle" data-testid="expected" />
            <Closed density={density} />
          </>,
        );
        const expected = getComputedStyle(screen.getByTestId("expected")).backgroundColor;
        await userEvent.click(screen.getByRole("button", { name: "記録の操作" }));
        const surface = getComputedStyle(screen.getByRole("menu")).backgroundColor;
        const item = screen.getAllByRole("menuitem")[1] as HTMLElement;
        await userEvent.hover(item);
        await expect.poll(() => getComputedStyle(item).backgroundColor).toBe(expected);
        expect(expected).not.toBe(surface);
      } finally {
        delete document.documentElement.dataset.theme;
      }
    },
  );
});
