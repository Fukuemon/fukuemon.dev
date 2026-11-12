import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { fn } from "storybook/test";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./ConfirmDialog.stories";

const { Closed, Confirming } = composeStories(stories);

const openDialog = async (onConfirm = fn()) => {
  render(<Closed onConfirm={onConfirm} />);
  const opener = screen.getByRole("button", { name: "server.js を削除" });
  await userEvent.click(opener);
  return {
    opener,
    onConfirm,
    dialog: screen.getByRole("dialog", { name: "server.js を削除する" }),
  };
};

describe("ConfirmDialog", () => {
  it("開くと、題と本文に失うものの名前を出し、やめるのボタンにフォーカスを当てる", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent("src/server.js を削除する。");
    expect(screen.getByRole("button", { name: "やめる" })).toHaveFocus();
  });

  it("やめるのボタンで閉じ、開いたボタンにフォーカスを戻し、確定の処理を呼ばない", async () => {
    const { opener, onConfirm } = await openDialog();
    await userEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Esc のキーで閉じ、開いたボタンにフォーカスを戻し、確定の処理を呼ばない", async () => {
    const { opener, onConfirm } = await openDialog();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("確定のボタンを押すと、確定の処理を 1 回だけ呼ぶ", async () => {
    const { onConfirm } = await openDialog();
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("確定の処理中は、確定のボタンを押しても確定の処理を呼ばず、Esc のキーとやめるのボタンで閉じない", async () => {
    const onConfirm = fn();
    render(<Confirming onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "削除する" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    // Playwright は aria-disabled の要素を押せないものとして待つので、force で押す
    await userEvent.click(screen.getByRole("button", { name: "やめる" }), { force: true });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("確定とやめるのボタンは、44×44 px 以上で押せる", async () => {
    await openDialog();
    for (const name of ["やめる", "削除する"]) {
      const rect = screen.getByRole("button", { name }).getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });
});
