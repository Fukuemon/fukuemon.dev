import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./ConsoleEntryList.stories";
import { type ConsoleValue, preview } from "./consoleValue";

const { Default, ErrorOnly, Empty, Loading, Error } = composeStories(stories);

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
const filter = (name: RegExp) => screen.getByRole("button", { name });

describe("ConsoleEntryList", () => {
  it("行ごとに、ログレベルの名前と印を出し、warn と error の行には状態の色を当てる", () => {
    render(<Default />);
    const levels = rows().map((row) => row.querySelector(".sr-only")?.textContent);
    expect(levels).toEqual(["デバッグ", "ログ", "情報", "警告", "エラー", "ログ", "ログ"]);
    expect(rows()[3]).toHaveClass("border-warning", "bg-warning-surface");
    expect(rows()[4]).toHaveClass("border-danger", "bg-danger-surface");
    expect(rows()[4]?.querySelector("svg")).toHaveClass("text-danger");
  });

  it("行に出力元を出す", () => {
    render(<Default />);
    expect(within(rows()[2] as HTMLElement).getByText("プレビュー")).toBeInTheDocument();
    expect(within(rows()[0] as HTMLElement).getByText("server.js")).toBeInTheDocument();
  });

  it("ログレベルのボタンを押すと、そのログレベルの行を隠し、もう 1 回押すと戻す", async () => {
    render(<Default />);
    expect(filter(/^log/)).toHaveAttribute("aria-pressed", "true");
    expect(filter(/^log/)).toHaveAccessibleName("log 3");
    await userEvent.click(filter(/^log/));
    expect(filter(/^log/)).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(4);
    await userEvent.click(filter(/^log/));
    expect(rows()).toHaveLength(7);
  });

  it("error だけを選ぶと、error の行だけを表示する", () => {
    render(<ErrorOnly />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("TypeError: Cannot read properties of undefined");
  });

  it("全てのログレベルを外すと、行の代わりに文を出す", async () => {
    render(<ErrorOnly />);
    await userEvent.click(filter(/^error/));
    expect(screen.getByText("選んだログレベルの行はありません。")).toBeInTheDocument();
  });

  it("入れ子のオブジェクトを開くと、項目の名前と値をツリーで出す", async () => {
    render(<Default />);
    const root = screen.getByRole("treeitem", { name: /^\{id: 42/ });
    expect(root).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(root);
    expect(screen.getByRole("treeitem", { name: 'name: "山田 花子"' })).toBeInTheDocument();
    const session = screen.getByRole("treeitem", { name: /^session: \{expiresAt/ });
    await userEvent.click(session);
    expect(screen.getByRole("treeitem", { name: "refresh: true" })).toBeInTheDocument();
  });

  it("キーボードだけで、フィルタを切り替え、ツリーを開閉できる", async () => {
    render(<Default />);
    await userEvent.tab();
    expect(filter(/^debug/)).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(filter(/^debug/)).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(6);
    await userEvent.keyboard("{Enter}");
    expect(filter(/^debug/)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 5; i++) await userEvent.tab();
    const root = screen.getByRole("treeitem", { name: /^\{id: 42/ });
    expect(root).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(root).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(root).toHaveAttribute("aria-expanded", "false");
  });

  it("フィルタのボタンとツリーの項目は、44 px 以上の高さで押せる", () => {
    render(<Default />);
    for (const button of within(screen.getByRole("group")).getAllByRole("button")) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it("空、読み込み中、エラーでは、行の代わりに文を出す", () => {
    const { unmount } = render(<Empty />);
    expect(screen.getByText("まだログがありません。")).toBeInTheDocument();
    unmount();
    const loading = render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("実行環境を起動しています");
    loading.unmount();
    render(<Error />);
    expect(screen.getByRole("alert")).toHaveTextContent("コンソールの記録を読めませんでした");
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("preview", () => {
  const cases: [ConsoleValue, boolean, string][] = [
    [{ kind: "string", value: "a" }, false, "a"],
    [{ kind: "string", value: "a" }, true, '"a"'],
    [{ kind: "number", value: -0 }, false, "-0"],
    [{ kind: "bigint", value: "10" }, false, "10n"],
    [{ kind: "symbol", description: "id" }, false, "Symbol(id)"],
    [{ kind: "function", name: "" }, false, "ƒ (anonymous)()"],
    [{ kind: "array", items: [] }, true, "Array(0)"],
    [
      {
        kind: "array",
        items: [1, 2, 3, 4, 5, 6].map((value) => ({ kind: "number", value }) as const),
      },
      false,
      "Array(6) [1, 2, 3, 4, 5, …]",
    ],
    [{ kind: "object", className: "Foo", entries: [] }, true, "Foo {…}"],
    [{ kind: "error", name: "Error", message: "x" }, false, "Error: x"],
  ];
  it.each(cases)("%j を、入れ子の中か %s で 1 行の文字にする", (value, isNested, expected) => {
    expect(preview(value, isNested)).toBe(expected);
  });
});
