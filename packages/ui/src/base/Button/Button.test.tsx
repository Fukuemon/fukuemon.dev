import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { fn } from "storybook/test";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Button.stories";

const { Primary, PrimaryDisabled, Loading, SecondaryLoading, DangerLoading, Small } =
  composeStories(stories);

describe("Button", () => {
  it("押すと onClick を呼ぶ。Enter と Space でも押せる", async () => {
    const onClick = fn();
    render(<Primary onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("キーボードでフォーカスすると、要素から 2 px 離して墨の 2 px の輪を出す", async () => {
    render(<Primary />);
    const button = screen.getByRole("button", { name: "保存" });
    await userEvent.tab();
    expect(button).toHaveFocus();
    const style = getComputedStyle(button);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(style.outlineOffset).toBe("2px");
    render(<span className="text-text" data-testid="text" />);
    expect(style.outlineColor).toBe(getComputedStyle(screen.getByTestId("text")).color);
    expect(style.boxShadow).toBe("none");
  });

  it("無効のときは aria-disabled を付け、フォーカスを受けるが onClick を呼ばない", async () => {
    const onClick = fn();
    render(<PrimaryDisabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "保存" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    // Playwright は aria-disabled の要素を押せないものとして待つので、force で押す
    await userEvent.click(button, { force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("読み込み中は名前を残したまま onClick を呼ばない", async () => {
    const onClick = fn();
    render(<Loading onClick={onClick} />);
    const button = screen.getByRole("button", { name: "保存" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("読み込み中の主と danger のボタンは、hover で色を変えない", async () => {
    for (const Story of [Loading, DangerLoading]) {
      const { unmount } = render(<Story />);
      const button = screen.getByRole("button");
      const before = getComputedStyle(button).backgroundColor;
      await userEvent.hover(button);
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(getComputedStyle(button).backgroundColor).toBe(before);
      unmount();
    }
  });

  it("読み込み中でない主のボタンは、hover で色を変える", async () => {
    render(<Primary />);
    const button = screen.getByRole("button", { name: "保存" });
    const before = getComputedStyle(button).backgroundColor;
    await userEvent.hover(button);
    await expect.poll(() => getComputedStyle(button).backgroundColor).not.toBe(before);
  });

  it("読み込み中の印の 3 つの点は、ボタンの文の色で動く", () => {
    for (const Story of [Loading, SecondaryLoading]) {
      const { unmount } = render(<Story />);
      const button = screen.getByRole("button", { name: "保存" });
      const dots = button.querySelectorAll("[aria-hidden] > span");
      expect(dots).toHaveLength(3);
      for (const dot of dots) {
        const style = getComputedStyle(dot);
        expect(style.animationName).toBe("fd-loading-dot");
        expect(style.backgroundColor).toBe(getComputedStyle(button).color);
      }
      unmount();
    }
  });

  it("墨のにじみの面は、押す前は見えず、クリックを受けない", () => {
    render(<Primary />);
    const ink = getComputedStyle(screen.getByRole("button", { name: "保存" }), "::before");
    expect(ink.opacity).toBe("0");
    expect(ink.pointerEvents).toBe("none");
  });

  it("S のボタンは、見た目の外まで 44×44 px 以上を押せる", () => {
    render(
      <div className="p-4">
        <Small />
      </div>,
    );
    const button = screen.getByRole("button", { name: "保存" });
    const rect = button.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    const centerX = rect.left + rect.width / 2;
    // 見た目の上端と下端の 1px 外を押しても、ボタンに当たる
    expect(document.elementFromPoint(centerX, rect.top - 1)).toBe(button);
    expect(document.elementFromPoint(centerX, rect.bottom + 1)).toBe(button);
  });
});
