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

  it("新しいファイルの欄は、選んだファイルのディレクトリの子の先頭に、ほかの行と同じ字下げで出る。Enter のキーで確定すると、そこに作り、作った項目にフォーカスが移る", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    const field = screen.getByRole("textbox", { name: "新しいファイルの名前" });
    expect(field).toHaveFocus();
    const row = field.closest("li")!;
    const sibling = screen.getByRole("treeitem", { name: "server.js" });
    expect(row.nextElementSibling).toBe(sibling);
    expect(row).toHaveAttribute("aria-level", "2");
    expect(getComputedStyle(row).paddingInlineStart).toBe(
      getComputedStyle(sibling).paddingInlineStart,
    );
    expect(row.querySelector("[data-icon]")).not.toBeNull();

    await userEvent.keyboard("token.js{Enter}");
    expect(Default.args.onCreate).toHaveBeenCalledWith("token.js", "src");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("treeitem", { name: "token.js" })).toHaveFocus();
  });

  it("閉じたディレクトリを選んで新しいディレクトリを作ると、そのディレクトリを開き、中に欄を出す", async () => {
    render(<Default />);
    const src = screen.getByRole("treeitem", { name: "src" });
    await userEvent.click(src);
    expect(src).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(screen.getByRole("button", { name: "新しいディレクトリ" }));
    const field = screen.getByRole("textbox", { name: "新しいディレクトリの名前" });
    expect(field).toHaveFocus();
    expect(src).toHaveAttribute("aria-expanded", "true");
    expect(src.nextElementSibling).toBe(field.closest("li"));
    await userEvent.keyboard("lib{Enter}");
    expect(Default.args.onCreateDirectory).toHaveBeenCalledWith("lib", "src");
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("選んだファイルが閉じたディレクトリの中にあるときも、そのディレクトリを開いて欄を出す", async () => {
    render(<Default />);
    const src = screen.getByRole("treeitem", { name: "src" });
    src.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(src).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    expect(src).toHaveAttribute("aria-expanded", "true");
    expect(src.nextElementSibling).toBe(screen.getByRole("textbox").closest("li"));
  });

  it("名前の欄は Esc のキーでやめ、木を前のままにして、フォーカスを前の項目へ戻す", async () => {
    render(<Default />);
    const before = labels();
    const item = screen.getByRole("treeitem", { name: "package.json" });
    item.focus();
    await userEvent.keyboard("{F2}");
    await userEvent.keyboard("draft{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(labels()).toEqual(before);
    expect(item).toHaveFocus();
    expect(Default.args.onRename).not.toHaveBeenCalled();
  });

  it("名前の欄で打つ文字、Delete のキー、クリックは、木の操作に使わない", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("pack{Delete}");
    expect(screen.getByRole("textbox")).toHaveValue("pack");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("textbox"));
    expect(screen.getByRole("treeitem", { name: "src" })).toHaveAttribute("aria-expanded", "true");
  });

  it.each([
    ["同じディレクトリにある名前", "callback.js", "callback.js は、この場所に既にあります。"],
    ["/ を含む名前", "a/b.js", "名前に / は使えません。"],
    [". だけの名前", ".", ". と .. は名前に使えません。"],
    [".. だけの名前", "..", ". と .. は名前に使えません。"],
    ["空白だけの名前", "   ", "名前を入れてください。"],
  ])("%s は、Enter のキーで確定せず、欄を開いたまま行の下に理由を出す", async (_, name, reason) => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard(`${name}{Enter}`);
    const field = screen.getByRole("textbox", { name: "新しいファイルの名前" });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(reason);
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("理由を出した後に名前を直すと、理由を消す", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("callback.js{Enter}");
    await userEvent.keyboard("{Backspace}{Backspace}ts");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });

  it("IME の変換を確定する Enter では、名前を確定しない", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("token.js");
    const field = screen.getByRole("textbox");
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("空の名前のまま欄からフォーカスが外れると、やめる", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.click(document.body);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("誤りのある名前のまま欄からフォーカスが外れると、やめる", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("callback.js");
    await userEvent.click(document.body);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("誤りの無い名前のまま欄からフォーカスが外れると、確定する", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("token.js");
    await userEvent.click(document.body);
    expect(Default.args.onCreate).toHaveBeenCalledExactlyOnceWith("token.js", "src");
  });

  it("欄から Tab のキーで移ると確定し、フォーカスは移った先に残す", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("token.js");
    await userEvent.tab({ shift: true });
    expect(Default.args.onCreate).toHaveBeenCalledWith("token.js", "src");
    await expect.poll(() => Default.args.onCreate).toHaveBeenCalledWith("token.js", "src");
    expect(screen.getByRole("button", { name: "token.js の操作" })).toHaveFocus();
  });

  it("閉じたディレクトリの中の選んだ項目をメニューから名前の変更にすると、ディレクトリを開いて欄を出す", async () => {
    render(<Default />);
    const src = screen.getByRole("treeitem", { name: "src" });
    src.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.click(screen.getByRole("button", { name: "server.js の操作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "名前を変える" }));
    expect(src).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "新しい名前" })).toHaveValue("server.js");
  });

  it("Esc のキーでやめた後に欄が外れても、確定しない", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("token.js{Escape}");
    await userEvent.click(document.body);
    expect(Default.args.onCreate).not.toHaveBeenCalled();
  });

  it("メニューから、選んだ項目の名前を行の中の欄で変え、削除する", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("button", { name: "server.js の操作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "名前を変える" }));
    const field = screen.getByRole("textbox", { name: "新しい名前" });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("server.js");
    expect(field.closest("[role=treeitem]")).toHaveAttribute("aria-level", "2");
    await userEvent.keyboard("app{Enter}");
    expect(Default.args.onRename).toHaveBeenCalledWith("src/server.js", "app.js");
    expect(labels()).toContain("app.js");

    await userEvent.click(screen.getByRole("button", { name: "app.js の操作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(Default.args.onDelete).toHaveBeenCalledWith("src/server.js");
    expect(labels()).not.toContain("app.js");
  });

  it("木の項目で Delete のキーを押すと、その項目の名前を題にした確認のダイアログが開く。やめると閉じ、フォーカスが項目に戻る", async () => {
    render(<Default />);
    const item = screen.getByRole("treeitem", { name: "package.json" });
    item.focus();
    await userEvent.keyboard("{Delete}");
    const dialog = screen.getByRole("dialog", { name: "package.json を削除する" });
    expect(dialog).toBeInTheDocument();
    expect(Default.args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(item).toHaveFocus();
    expect(labels()).toContain("package.json");
    expect(Default.args.onDelete).not.toHaveBeenCalled();
  });

  it("木の項目で Delete のキーを押して確認のダイアログで確定すると、項目を消す", async () => {
    render(<Default />);
    screen.getByRole("treeitem", { name: "package.json" }).focus();
    await userEvent.keyboard("{Delete}");
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(Default.args.onDelete).toHaveBeenCalledWith("package.json");
    expect(labels()).not.toContain("package.json");
  });

  it("onDelete を渡さないときは、Delete のキーでダイアログを開かない", async () => {
    render(<ReadOnly />);
    const [item] = screen.getAllByRole("treeitem");
    item!.focus();
    await userEvent.keyboard("{Delete}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("木の項目で F2 のキーを押すと、その行の名前が欄になり、拡張子の前までを選ぶ。Enter のキーで確定すると、フォーカスが項目に戻る", async () => {
    render(<Default />);
    const item = screen.getByRole("treeitem", { name: "package.json" });
    expect(item).toHaveAttribute("aria-keyshortcuts", "F2 Delete");
    item.focus();
    await userEvent.keyboard("{F2}");
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "新しい名前" });
    expect(item).toContainElement(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("package.json");
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, "package".length]);
    await userEvent.keyboard("pkg{Enter}");
    expect(Default.args.onRename).toHaveBeenCalledWith("package.json", "pkg.json");
    expect(screen.getByRole("treeitem", { name: "pkg.json" })).toHaveFocus();
  });

  it("ディレクトリと、. で始まる名前の F2 では、名前の全体を選ぶ。名前を変えずに確定すると onRename を呼ばない", async () => {
    render(<Default />);
    screen.getByRole("treeitem", { name: "src" }).focus();
    await userEvent.keyboard("{F2}");
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "新しい名前" });
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 3]);
    await userEvent.keyboard("{End}{Enter}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(Default.args.onRename).not.toHaveBeenCalled();
  });

  it("名前の変更では、自分の名前を同じ名前の誤りにせず、同じディレクトリのほかの名前を誤りにする", async () => {
    render(<Default />);
    screen.getByRole("treeitem", { name: "server.js" }).focus();
    await userEvent.keyboard("{F2}");
    await userEvent.keyboard("callback{Enter}");
    const field = screen.getByRole("textbox", { name: "新しい名前" });
    expect(field).toHaveAccessibleDescription("callback.js は、この場所に既にあります。");
    expect(Default.args.onRename).not.toHaveBeenCalled();
  });

  it("onRename を渡さないときは、F2 のキーで欄を開かない", async () => {
    render(<ReadOnly />);
    const [item] = screen.getAllByRole("treeitem");
    expect(item).not.toHaveAttribute("aria-keyshortcuts");
    item!.focus();
    await userEvent.keyboard("{F2}");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("何も選んでいないときは、操作のメニューを出さず、いちばん上の段に作る", async () => {
    render(<NoSelection />);
    expect(screen.queryByRole("button", { name: /の操作$/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    await userEvent.keyboard("README.md{Enter}");
    expect(NoSelection.args.onCreate).toHaveBeenCalledWith("README.md", undefined);
  });

  it("何も選んでいないときは、欄の行を木の先頭に、1 段目の字下げで出す", async () => {
    render(<NoSelection />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    const row = screen.getByRole("textbox").closest("li")!;
    expect(screen.getByRole("tree").firstElementChild).toBe(row);
    expect(row).toHaveAttribute("aria-level", "1");
  });

  it("名前の欄の行は、ほかの項目と同じ 24 px の高さになる", async () => {
    render(<NoSelection />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    const row = screen.getByRole("textbox").closest("li")!;
    expect(row.getBoundingClientRect().height).toBe(24);
  });

  it("ファイルが無いときも、新しいファイルの欄を出して作れる", async () => {
    render(<Empty />);
    await userEvent.click(screen.getByRole("button", { name: "新しいファイル" }));
    expect(screen.getByRole("tree")).toBeInTheDocument();
    await userEvent.keyboard("main.go{Enter}");
    expect(Empty.args.onCreate).toHaveBeenCalledWith("main.go", undefined);
  });

  it("題の右の操作は 28 px 四方、木の項目は 24 px の高さと 13 px の文字で押せる（ADR-0062）", () => {
    render(<Default />);
    const targets = [
      screen.getByRole("button", { name: "新しいファイル" }),
      screen.getByRole("button", { name: "新しいディレクトリ" }),
      screen.getByRole("button", { name: "server.js の操作" }),
    ];
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      expect(rect.width).toBe(28);
      expect(rect.height).toBe(28);
    }
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item.getBoundingClientRect().height).toBe(24);
      expect(getComputedStyle(item).fontSize).toBe("13px");
    }
  });

  it("ディレクトリの印は開閉で形が変わり、ファイルの印は拡張子の系統で変わる", async () => {
    render(<Default />);
    const iconOf = (name: string) =>
      screen
        .getByRole("treeitem", { name })
        .querySelector("[data-icon]")
        ?.getAttribute("data-icon");
    expect(iconOf("src")).toBe("directory-open");
    expect(iconOf("server.js")).toBe("code");
    expect(iconOf("package.json")).toBe("data");
    await userEvent.click(screen.getByRole("treeitem", { name: "src" }));
    expect(iconOf("src")).toBe("directory");
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
