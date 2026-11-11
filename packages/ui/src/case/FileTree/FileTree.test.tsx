import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./FileTree.stories";

const { Default, NoSelection, ReadOnly, Empty } = composeStories(stories);

const labels = () => screen.getAllByRole("treeitem").map((item) => item.textContent);

describe("FileTree", () => {
  // story の args の spy はテストの間で共有されるので、呼ばれた回数をテストごとに消す
  beforeEach(() => {
    for (const spy of [
      Default.args.onCreate,
      Default.args.onCreateDirectory,
      Default.args.onRename,
      Default.args.onDelete,
    ]) {
      vi.mocked(spy)?.mockClear();
    }
  });

  it("新しいファイルの名前を Enter のキーで確定すると、選んだファイルのディレクトリに作る", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    const field = screen.getByRole("textbox", { name: "新しいファイルの名前" });
    expect(field).toHaveFocus();
    await userEvent.keyboard("token.js{Enter}");
    expect(Default.args.onCreate).toHaveBeenCalledWith("token.js", "src");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(labels()).toContain("token.js");
  });

  it("ディレクトリを選んで新しいディレクトリを作ると、そのディレクトリの中に作る", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("treeitem", { name: "src" }));
    await userEvent.click(screen.getByRole("button", { name: "新しいディレクトリ" }));
    expect(screen.getByRole("textbox", { name: "新しいディレクトリの名前" })).toHaveFocus();
    await userEvent.keyboard("lib{Enter}");
    expect(Default.args.onCreateDirectory).toHaveBeenCalledWith("lib", "src");
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("名前の欄は Esc のキーでやめ、何も作らない", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("draft.js{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("空の名前と空白だけの名前では確定せず、欄を開いたままにする", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "新しいファイルの名前" })).toBeInTheDocument();
    await userEvent.keyboard("   {Enter}");
    expect(screen.getByRole("textbox", { name: "新しいファイルの名前" })).toBeInTheDocument();
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("メニューから、選んだ項目の名前を変え、削除する", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "server.js の操作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "名前を変える" }));
    const field = screen.getByRole("textbox", { name: "新しい名前" });
    expect(field).toHaveValue("server.js");
    await userEvent.clear(field);
    await userEvent.type(field, "app.js");
    await userEvent.click(screen.getByRole("button", { name: "変える" }));
    expect(Default.args.onRename).toHaveBeenCalledWith("src/server.js", "app.js");
    expect(labels()).toContain("app.js");

    await userEvent.click(screen.getByRole("button", { name: "app.js の操作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    expect(Default.args.onDelete).toHaveBeenCalledWith("src/server.js");
    expect(labels()).not.toContain("app.js");
  });

  it("何も選んでいないときは、操作のメニューを出さず、いちばん上の段に作る", async () => {
    render(<NoSelection />);
    expect(screen.queryByRole("button", { name: /の操作$/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("README.md{Enter}");
    expect(NoSelection.args.onCreate).toHaveBeenCalledWith("README.md", undefined);
  });

  it("題の右の操作と木の項目は、44 px 四方以上で押せる", () => {
    render(<Default />);
    const targets = [
      screen.getByRole("button", { name: "新しいファイル" }),
      screen.getByRole("button", { name: "新しいディレクトリ" }),
      screen.getByRole("button", { name: "server.js の操作" }),
    ];
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it("操作の props を渡さないときは、操作を出さない", () => {
    render(<ReadOnly />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("tree", { name: "ファイル" })).toBeInTheDocument();
  });

  it("ファイルが無いときは、木の代わりに文を出す", () => {
    render(<Empty />);
    expect(screen.getByText("ファイルがありません。")).toBeInTheDocument();
    expect(screen.queryByRole("tree")).toBeNull();
  });
});
