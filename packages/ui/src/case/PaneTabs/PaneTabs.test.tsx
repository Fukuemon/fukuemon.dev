import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import { ToolPane } from "../ToolPane/ToolPane";
import { PaneTabs } from "./PaneTabs";
import * as stories from "./PaneTabs.stories";

const { Bottom, Start, Top } = composeStories(stories);

describe("PaneTabs", () => {
  it("タブを替えても、隠したペインを描いたまま残し、入力が消えない", async () => {
    render(<Bottom />);
    await userEvent.type(screen.getByRole("textbox", { name: "エディタの中身" }), "abc");
    await userEvent.click(screen.getByRole("tab", { name: "端末" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("~/project");
    expect(screen.queryByRole("textbox", { name: "エディタの中身" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "エディタ" }));
    expect(screen.getByRole("textbox", { name: "エディタの中身" })).toHaveValue("abc");
  });

  it("下の帯では、左右の矢印のキーで隣のタブへ移って選び、端から反対の端へ回る", async () => {
    render(<Bottom />);
    await userEvent.click(screen.getByRole("tab", { name: "エディタ" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "端末" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "端末" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "プレビュー" })).toHaveFocus();
  });

  it("左の縦の帯では、上下の矢印のキーで移り、並びを縦と読み上げる", async () => {
    render(<Start />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
    await userEvent.click(screen.getByRole("tab", { name: "エディタ" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "端末" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "プレビュー" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "エディタ" })).toHaveFocus();
  });

  it("どの置き場でも、タブと先頭の操作を 44×44 px 以上で押せる", () => {
    for (const Story of [Bottom, Start, Top]) {
      const { unmount } = render(<Story />);
      for (const target of [
        ...screen.getAllByRole("tab"),
        screen.getByRole("button", { name: "ファイル" }),
      ]) {
        const box = target.getBoundingClientRect();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      unmount();
    }
  });

  it.each([
    [false, "10px"],
    [true, "0px"],
  ])(
    "flush が %s のとき、中のペインの題を読み上げだけに残し、面の角を %s で丸める",
    (flush, radius) => {
      render(
        <PaneTabs
          flush={flush}
          items={[
            { id: "a", label: "出力", icon: null, content: <ToolPane title="出力">中身</ToolPane> },
          ]}
          label="ペイン"
          onSelect={() => {}}
          placement="top"
          selectedId="a"
        />,
      );
      const pane = screen.getByRole("region", { name: "出力" });
      expect(getComputedStyle(pane).borderTopLeftRadius).toBe(radius);
      expect(screen.getByRole("heading", { name: "出力" })).toHaveClass("sr-only");
    },
  );
});
