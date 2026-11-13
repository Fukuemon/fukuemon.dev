import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import { TreeView } from "./TreeView";
import * as stories from "./TreeView.stories";

const { Collapsed, Expanded, WithContent } = composeStories(stories);

const item = (name: string) => screen.getByRole("treeitem", { name });

describe("TreeView", () => {
  it("右の矢印のキーで、閉じた枝を開き、開いた枝では最初の子へ移る", async () => {
    render(<Collapsed />);
    await userEvent.tab();
    expect(item("src")).toHaveFocus();
    expect(item("src")).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowRight}");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(item("src")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(item("index.ts")).toHaveFocus();
  });

  it("左の矢印のキーで、子から親へ移り、開いた枝を閉じる", async () => {
    render(<Expanded />);
    await userEvent.tab();
    expect(item("token.ts")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(item("routes")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(item("routes")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: "token.ts" })).toBeNull();
  });

  it("上下の矢印と Home と End で見えている項目の間を移り、フォーカスの移動では選ばない", async () => {
    render(<Expanded />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(item("package.json")).toHaveFocus();
    expect(item("token.ts")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(item("src")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(item("README.md")).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(item("package.json")).toHaveFocus();
  });

  it("文字を打つと、その文字で始まる項目へ移り、続けて打つと並びで探す。同じ文字の繰り返しは巡る", async () => {
    render(<Expanded />);
    await userEvent.tab();
    await userEvent.keyboard("p");
    expect(item("package.json")).toHaveFocus();
    expect(item("token.ts")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}to");
    expect(item("token.ts")).toHaveFocus();
    await userEvent.keyboard("{End}");
    await userEvent.keyboard("zzz");
    expect(item("README.md")).toHaveFocus();
    await userEvent.keyboard("{Home}r");
    expect(item("routes")).toHaveFocus();
    await userEvent.keyboard("r");
    expect(item("README.md")).toHaveFocus();
  });

  it("Enter のキーで項目を選び、Tab のキーの順に入るのは 1 つの項目だけにする", async () => {
    render(<Expanded />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(item("package.json")).toHaveAttribute("aria-selected", "true");
    expect(item("token.ts")).toHaveAttribute("aria-selected", "false");
    const tabStops = screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0);
    expect(tabStops).toEqual([item("package.json")]);
  });

  it("項目は 44 px の高さで押せ、枝を押すと開閉する", async () => {
    render(<Collapsed />);
    expect(item("src").getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(item("src"));
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(item("index.ts")).toBeInTheDocument();
  });

  it("density を compact にすると、項目は 24 px 以上 44 px 未満の高さになる", () => {
    render(
      <TreeView
        density="compact"
        items={[{ id: "src", label: "src", children: [{ id: "a", label: "a.ts" }] }]}
        label="ファイル"
      />,
    );
    const height = item("src").getBoundingClientRect().height;
    expect(height).toBeGreaterThanOrEqual(24);
    expect(height).toBeLessThan(44);
  });

  it("content を渡すと、label の代わりに content を描き、タイプアヘッドは label で探す", async () => {
    render(<WithContent />);
    expect(item("user: {id: 42}").querySelector(".font-bold")).toHaveTextContent("user:");
    await userEvent.tab();
    await userEvent.keyboard("n");
    expect(item("名前の項目")).toHaveFocus();
  });
});
