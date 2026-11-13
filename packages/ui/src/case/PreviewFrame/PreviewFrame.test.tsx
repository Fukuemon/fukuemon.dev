import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./PreviewFrame.stories";

const { Default, Empty, Error } = composeStories(stories);

describe("PreviewFrame", () => {
  it("URL を書き換えられない欄に出し、iframe を置く", () => {
    render(<Default />);
    const field = screen.getByRole("textbox", { name: "プレビューの URL" });
    expect(field).toHaveValue("https://client.example:3000/");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByTitle("プレビューの画面")).toBeInTheDocument();
  });

  it("URL の欄の面と再読み込みのボタンは、上下の中央がそろう", () => {
    render(<Default />);
    const field = screen.getByRole("textbox", { name: "プレビューの URL" }).getBoundingClientRect();
    const button = screen.getByRole("button", { name: "再読み込み" }).getBoundingClientRect();
    expect(field.top + field.height / 2).toBe(button.top + button.height / 2);
  });

  it("ダミーの中身の色は、開いている画面のテーマの地の色と文字の色にそろう", () => {
    const srcDocOf = () => screen.getByTitle("プレビューの画面").getAttribute("srcdoc") ?? "";
    const { unmount } = render(<Default />);
    const light = srcDocOf();
    expect(light).toContain(getComputedStyle(document.body).backgroundColor);
    unmount();
    document.documentElement.setAttribute("data-theme", "dark");
    try {
      render(<Default />);
      expect(srcDocOf()).toContain(getComputedStyle(document.body).backgroundColor);
      expect(srcDocOf()).not.toBe(light);
    } finally {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  it("再読み込みのボタンは 44 px 四方以上で押せ、押すと onReload を呼ぶ", async () => {
    render(<Default />);
    const button = screen.getByRole("button", { name: "再読み込み" });
    const rect = button.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    await userEvent.click(button);
    expect(Default.args.onReload).toHaveBeenCalledOnce();
  });

  it("onReload を渡さないときはボタンを出さず、エラーでは iframe を描かない", () => {
    const { unmount } = render(<Empty />);
    expect(screen.queryByRole("button", { name: "再読み込み" })).toBeNull();
    unmount();
    render(<Error />);
    expect(screen.getByRole("alert")).toHaveTextContent("プレビューを開けませんでした");
    expect(screen.queryByTitle("プレビューの画面")).toBeNull();
  });
});
