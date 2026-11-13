import { composeStories } from "@storybook/react-vite";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Dialog.stories";

const { Closed } = composeStories(stories);

describe("Dialog", () => {
  it("開くと題を名前にしたダイアログを出し、Esc のキーで閉じて、開いたボタンにフォーカスを戻す", async () => {
    render(<Closed />);
    const opener = screen.getByRole("button", { name: "記録を消す" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "HTTP の記録を消す" });
    // 開いた直後は濃度が 0 から上がる途中なので、見えるまで待つ
    await waitFor(() => expect(dialog).toBeVisible());
    expect(getComputedStyle(dialog).animationName).toBe("fd-fade-in");
    const stroke = dialog.querySelector("span[aria-hidden]");
    if (!(stroke instanceof HTMLElement)) throw new Error("上端の筆の線が無い");
    expect(getComputedStyle(stroke).animationName).toBe("fd-draw-stroke");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("閉じるボタンで閉じる。閉じるボタンは 44×44 px で押せる", async () => {
    render(<Closed />);
    await userEvent.click(screen.getByRole("button", { name: "記録を消す" }));
    const close = screen.getByRole("button", { name: "閉じる" });
    const rect = close.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    await userEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("開いている間は、Tab のキーでダイアログの後ろの要素へフォーカスが移らない", async () => {
    render(<Closed />);
    const opener = screen.getByRole("button", { name: "記録を消す" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    // 最後の要素の次は、ブラウザの画面の外（body）へ出る。showModal の仕様どおりの動きである
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(
        document.activeElement === document.body || dialog.contains(document.activeElement),
      ).toBe(true);
      expect(opener).not.toHaveFocus();
    }
  });
});
