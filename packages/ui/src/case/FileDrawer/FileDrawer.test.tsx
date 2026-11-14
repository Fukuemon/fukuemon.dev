import { composeStories } from "@storybook/react-vite";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./FileDrawer.stories";

const { Closed } = composeStories(stories);

describe("FileDrawer", () => {
  it("開くと initialFocus の要素にフォーカスを移し、Esc のキーで閉じて、開いたボタンにフォーカスを戻す", async () => {
    render(<Closed />);
    const opener = screen.getByRole("button", { name: "ファイルを開く" });
    await userEvent.click(opener);
    const drawer = screen.getByRole("dialog", { name: "Node の実行環境" });
    await waitFor(() => expect(drawer).toBeVisible());
    expect(getComputedStyle(drawer).animationName).toBe("fd-fade-in");
    expect(screen.getByRole("button", { name: "package.json" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("画面の左端から重ね、閉じるボタンを 44×44 px で押せる", async () => {
    render(<Closed />);
    await userEvent.click(screen.getByRole("button", { name: "ファイルを開く" }));
    const drawer = screen.getByRole("dialog");
    await waitFor(() => expect(drawer).toBeVisible());
    expect(drawer.getBoundingClientRect().left).toBe(0);
    const close = screen.getByRole("button", { name: "閉じる" });
    expect(close.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("外の面を押すと閉じる", async () => {
    render(<Closed />);
    await userEvent.click(screen.getByRole("button", { name: "ファイルを開く" }));
    const drawer = screen.getByRole("dialog");
    await waitFor(() => expect(drawer).toBeVisible());
    const box = drawer.getBoundingClientRect();
    await userEvent.click(drawer, { position: { x: box.width + 20, y: 100 } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
