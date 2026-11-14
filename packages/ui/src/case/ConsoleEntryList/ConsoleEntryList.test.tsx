import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import { SplitPane } from "../../base/SplitPane/SplitPane";
import {
  type ConsoleEntry,
  ConsoleEntryList,
  type ConsoleEntryListProps,
} from "./ConsoleEntryList";
import * as stories from "./ConsoleEntryList.stories";
import { type ConsoleValue, preview } from "./consoleValue";
import { MANY_ENTRIES } from "./fixtures";

const { Default, ErrorOnly, FixedHeight, Empty, Loading, Error } = composeStories(stories);

const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
const row = (index: number) => rows()[index] as HTMLElement;
const levelButton = (name: RegExp) => screen.getByRole("button", { name });
const treeItem = (name: string | RegExp) => screen.getByRole("treeitem", { name });

/**
 * 描画のフレームを count 回待つ。scroll イベントは描画の前に届くので、
 * scrollTop を変えた後に数フレーム待てば、コンポーネントが scroll イベントを受け取っている。
 */
const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (rest: number) =>
      rest === 0 ? resolve() : requestAnimationFrame(() => step(rest - 1));
    step(count);
  });

describe("ConsoleEntryList", () => {
  it("行ごとに、ログレベルの名前と印を出し、warn と error の行には状態の色を当てる", () => {
    render(<Default />);
    const levels = rows().map((item) => item.querySelector(".sr-only")?.textContent);
    expect(levels).toStrictEqual(["debug", "log", "info", "warn", "error", "log", "log"]);
    expect(row(3)).toHaveClass("border-warning", "bg-warning-surface");
    expect(row(4)).toHaveClass("border-danger", "bg-danger-surface");
    expect(row(4).querySelector("svg")).toHaveClass("text-danger");
  });

  it("行に、時刻があれば時刻を、出力元を出す", () => {
    const entries: ConsoleEntry[] = [
      { id: "1", level: "log", source: "server.js", time: "10:00:00.120", args: [] },
      { id: "2", level: "log", source: "プレビュー", args: [] },
    ];
    render(<ConsoleEntryList entries={entries} />);
    expect(row(0)).toHaveTextContent("10:00:00.120server.js");
    expect(row(1)).toHaveTextContent(/^logプレビュー$/);
  });

  it("ログレベルのボタンを押すと、そのログレベルの行を隠し、もう 1 回押すと戻す", async () => {
    render(<Default />);
    expect(levelButton(/^log/)).toHaveAttribute("aria-pressed", "true");
    expect(levelButton(/^log/)).toHaveAccessibleName("log 3 件");
    await userEvent.click(levelButton(/^log/));
    expect(levelButton(/^log/)).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(4);
    await userEvent.click(levelButton(/^log/));
    expect(rows()).toHaveLength(7);
  });

  it("error だけを選ぶと、error の行だけを表示する", () => {
    render(<ErrorOnly />);
    expect(rows()).toHaveLength(1);
    expect(row(0)).toHaveTextContent("TypeError: Cannot read properties of undefined");
  });

  it("全てのログレベルを外すと、行の代わりに文を出す", async () => {
    render(<ErrorOnly />);
    await userEvent.click(levelButton(/^error/));
    expect(screen.getByText("選んだログレベルの行はありません。")).toBeInTheDocument();
  });

  it("入れ子のオブジェクトを開くと、項目の名前と値をツリーで出す", async () => {
    render(<Default />);
    const root = treeItem(/^\{id: 42/);
    expect(root).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(root);
    expect(treeItem('name: "山田 花子"')).toBeInTheDocument();
    await userEvent.click(treeItem(/^session: \{expiresAt/));
    expect(treeItem("refresh: true")).toBeInTheDocument();
  });

  it("ログレベルを外して戻すと、その行の値の木は閉じている", async () => {
    render(<Default />);
    await userEvent.click(treeItem(/^\{id: 42/));
    expect(treeItem(/^\{id: 42/)).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(levelButton(/^info/));
    await userEvent.click(levelButton(/^info/));
    expect(treeItem(/^\{id: 42/)).toHaveAttribute("aria-expanded", "false");
  });

  it("Map を開くと「key => 値」で、Error を開くとスタックの行で出す", async () => {
    render(<Default />);
    await userEvent.click(treeItem(/^Map\(2\)/));
    expect(treeItem('"client.example" => 2')).toBeInTheDocument();
    await userEvent.click(treeItem(/^TypeError/));
    expect(treeItem(/^at callback \(\/home\/project\/src\/callback\.js/)).toBeInTheDocument();
  });

  it("中身の無い配列と、stack が空の Error は、ツリーにせず 1 行で出す", () => {
    const entries: ConsoleEntry[] = [
      {
        id: "1",
        level: "error",
        source: "server.js",
        args: [
          { kind: "array", items: [] },
          { kind: "error", name: "Error", message: "x", stack: [] },
        ],
      },
    ];
    render(<ConsoleEntryList entries={entries} />);
    expect(screen.queryByRole("tree")).toBeNull();
    expect(row(0)).toHaveTextContent("Array(0) []Error: x");
  });

  it("キーボードだけで、ログレベルを切り替え、ツリーを開閉できる", async () => {
    render(<Default />);
    await userEvent.tab();
    expect(levelButton(/^debug/)).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(levelButton(/^debug/)).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(6);
    await userEvent.keyboard("{Enter}");
    expect(levelButton(/^debug/)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 5; i++) await userEvent.tab();
    expect(screen.getByRole("region", { name: "ログの行" })).toHaveFocus();
    await userEvent.tab();
    const root = treeItem(/^\{id: 42/);
    expect(root).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(root).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(root).toHaveAttribute("aria-expanded", "false");
  });

  it("ログレベルのボタンは 28 px、ツリーの項目は 24 px 以上の高さで押せる", () => {
    render(<Default />);
    for (const button of within(screen.getByRole("group")).getAllByRole("button")) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(28);
    }
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    }
  });

  it("値の行は 1 行 21 px と 12 px の文字、ログレベルのボタンは 28 px と 13 px の文字に詰める", () => {
    // 狭い幅では時刻と出力元が値の下へ折り返すので、1 行に収まる幅で描く
    render(
      <div className="w-150">
        <Default />
      </div>,
    );
    const height = row(1).getBoundingClientRect().height;
    expect(height).toBeGreaterThanOrEqual(21);
    expect(height).toBeLessThan(22);
    expect(getComputedStyle(row(1).querySelector(".font-mono") as Element).fontSize).toBe("12px");
    const button = levelButton(/^debug/);
    expect(button.getBoundingClientRect().height).toBeLessThan(32);
    expect(getComputedStyle(button).fontSize).toBe("13px");
    expect(treeItem(/^\{id: 42/).closest('[role="tree"]')).toHaveStyle({ fontSize: "12px" });
  });

  it("高さを決めた枠では、題とボタンを残して、行の領域だけをスクロールする", async () => {
    render(<FixedHeight />);
    const rows = screen.getByRole("region", { name: "ログの行" });
    expect(rows.scrollHeight).toBeGreaterThan(rows.clientHeight);
    rows.scrollTop = 0;
    await nextFrames(3);
    expect(screen.getByRole("heading", { name: "コンソール" })).toBeVisible();
    expect(levelButton(/^debug/).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      rows.getBoundingClientRect().top,
    );
  });

  describe("components.md に書いた親の形で、行の領域だけをスクロールする", () => {
    const expectRowsScroll = () => {
      const rows = screen.getByRole("region", { name: "ログの行" });
      expect(rows.scrollHeight).toBeGreaterThan(rows.clientHeight);
      expect(levelButton(/^debug/).getBoundingClientRect().bottom).toBeLessThanOrEqual(
        rows.getBoundingClientRect().top,
      );
    };

    it("高さを持つ grid の親", () => {
      render(
        <div className="grid h-96">
          <ConsoleEntryList entries={MANY_ENTRIES} />
        </div>,
      );
      expectRowsScroll();
    });

    it("SplitPane の領域で、flex h-full flex-col の要素で包んだとき", () => {
      render(
        <div className="h-96">
          <SplitPane
            label="仕切り"
            orientation="vertical"
            primary={<p>上の領域</p>}
            secondary={
              <div className="flex h-full flex-col">
                <ConsoleEntryList entries={MANY_ENTRIES} />
              </div>
            }
          />
        </div>,
      );
      expectRowsScroll();
    });
  });

  describe("一番下への送り", () => {
    const entriesOf = (length: number): ConsoleEntry[] =>
      Array.from({ length }, (_, index) => ({
        id: String(index),
        level: "log",
        source: "server.js",
        args: [{ kind: "number", value: index }],
      }));
    const frame = (length: number, state?: ConsoleEntryListProps["state"]) => (
      <div className="flex h-80 flex-col">
        <ConsoleEntryList entries={entriesOf(length)} state={state} />
      </div>
    );
    const rows = () => screen.getByRole("region", { name: "ログの行" });
    const distanceToBottom = () => rows().scrollHeight - rows().scrollTop - rows().clientHeight;

    it("最初は一番下を見せ、一番下を見ているときだけ、行が増えると一番下へ送る", async () => {
      const { rerender } = render(frame(30));
      expect(distanceToBottom()).toBeLessThan(2);
      rerender(frame(31));
      await expect.poll(distanceToBottom).toBeLessThan(2);

      rows().scrollTop = 0;
      await nextFrames(3);
      rerender(frame(32));
      await nextFrames(3);
      expect(rows().scrollTop).toBe(0);
    });

    it("高さを決めない親では、行が増えてもページを送らない", async () => {
      const { rerender } = render(<ConsoleEntryList entries={entriesOf(60)} />);
      expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight);
      window.scrollTo(0, 0);
      rerender(<ConsoleEntryList entries={entriesOf(61)} />);
      await nextFrames(3);
      expect(window.scrollY).toBe(0);
    });

    it("読み込み中から同じ行に戻ったときも、一番下を見せる", async () => {
      const { rerender } = render(frame(30));
      rerender(frame(30, { kind: "loading", label: "実行環境を起動しています" }));
      rerender(frame(30));
      await expect.poll(distanceToBottom).toBeLessThan(2);
    });

    it("上へ戻した後に行が全て消えて空になると、一番下を見ている扱いに戻り、行が戻ると一番下を見せる", async () => {
      const { rerender } = render(frame(30));
      rows().scrollTop = 0;
      await nextFrames(3);
      rerender(frame(0));
      rerender(frame(30));
      await expect.poll(distanceToBottom).toBeLessThan(2);
    });

    it("上へ戻した後に読み込み中を挟むと、一番下を見ている扱いに戻り、行が増えると一番下へ送る", async () => {
      const { rerender } = render(frame(30));
      rows().scrollTop = 0;
      await nextFrames(3);
      rerender(frame(30, { kind: "loading", label: "実行環境を起動しています" }));
      rerender(frame(30));
      await expect.poll(distanceToBottom).toBeLessThan(2);
      rerender(frame(31));
      await expect.poll(distanceToBottom).toBeLessThan(2);
    });
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
  const numbers = (count: number): ConsoleValue[] =>
    Array.from({ length: count }, (_, value) => ({ kind: "number", value }));
  const cases: [ConsoleValue, boolean, string][] = [
    [{ kind: "string", value: "a" }, false, "a"],
    [{ kind: "string", value: "a" }, true, '"a"'],
    [{ kind: "number", value: -0 }, false, "-0"],
    [{ kind: "bigint", value: "10" }, false, "10n"],
    [{ kind: "boolean", value: false }, false, "false"],
    [{ kind: "null" }, false, "null"],
    [{ kind: "undefined" }, false, "undefined"],
    [{ kind: "symbol", description: "id" }, false, "Symbol(id)"],
    [{ kind: "function", name: "" }, false, "ƒ (anonymous)()"],
    [{ kind: "function", name: "render" }, false, "ƒ render()"],
    [{ kind: "text", value: "<div>" }, false, "<div>"],
    [{ kind: "circular" }, false, "[Circular]"],
    [{ kind: "array", items: [] }, true, "Array(0)"],
    [{ kind: "array", items: numbers(6) }, false, "Array(6) [0, 1, 2, 3, 4, …]"],
    [{ kind: "set", items: numbers(2) }, false, "Set(2) {0, 1}"],
    [{ kind: "set", items: numbers(2) }, true, "Set(2)"],
    [
      {
        kind: "map",
        entries: [{ key: { kind: "string", value: "a" }, value: { kind: "number", value: 0 } }],
      },
      false,
      'Map(1) {"a" => 0}',
    ],
    [{ kind: "map", entries: [] }, true, "Map(0)"],
    [{ kind: "object", entries: [] }, true, "{…}"],
    [{ kind: "object", className: "Foo", entries: [] }, true, "Foo {…}"],
    [
      {
        kind: "object",
        entries: numbers(6).map((value, index) => ({ key: `k${index}`, value })),
      },
      false,
      "{k0: 0, k1: 1, k2: 2, k3: 3, k4: 4, …}",
    ],
    [{ kind: "error", name: "Error", message: "x" }, false, "Error: x"],
  ];
  it.each(cases)("%j を、入れ子の中か %s で 1 行の文字にする", (value, isNested, expected) => {
    expect(preview(value, isNested)).toBe(expected);
  });

  it("行の領域のフォーカスの輪は、領域の内側に引く（ADR-0066）", () => {
    render(<Default />);
    const rows = screen.getByRole("region", { name: "ログの行" });
    const frame = rows.parentElement as HTMLElement;
    const before = getComputedStyle(frame, "::after").outlineStyle;
    rows.focus();
    const ring = getComputedStyle(frame, "::after");
    expect({
      before,
      ring: [ring.outlineStyle, ring.outlineOffset],
      own: getComputedStyle(rows).outlineStyle,
    }).toStrictEqual({ before: "none", ring: ["solid", "-2px"], own: "none" });
  });

  it("値の木の項目にフォーカスを置くと、行の領域の外側の輪は出ず、項目の輪が内側に引かれる（ADR-0066）", () => {
    render(<Default />);
    const frame = screen.getByRole("region", { name: "ログの行" }).parentElement as HTMLElement;
    const item = screen.getAllByRole("treeitem")[0] as HTMLElement;
    item.focus();
    expect({
      frame: getComputedStyle(frame, "::after").outlineStyle,
      item: [getComputedStyle(item).outlineStyle, getComputedStyle(item).outlineOffset],
    }).toStrictEqual({ frame: "none", item: ["solid", "-2px"] });
  });
});
