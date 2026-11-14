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

const { Default, ErrorOnly, FixedHeight, Empty, Loading, Pending, Error } = composeStories(stories);

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

  it("行に、印、時刻があれば時刻、値、出力元の順に出す", () => {
    const value = { kind: "string", value: "a" } as const;
    const entries: ConsoleEntry[] = [
      { id: "1", level: "log", source: "server.js", time: "10:00:00.120", args: [value] },
      { id: "2", level: "log", source: "プレビュー", args: [value] },
    ];
    render(<ConsoleEntryList entries={entries} />);
    expect([row(0).textContent, row(1).textContent]).toStrictEqual([
      "log10:00:00.120aserver.js",
      "logaプレビュー",
    ]);
  });

  it("時刻を、行をまたいで同じ位置の列に置く", () => {
    const entries: ConsoleEntry[] = [
      {
        id: "1",
        level: "log",
        source: "p",
        time: "10:00:00.120",
        args: [{ kind: "string", value: "a" }],
      },
      {
        id: "2",
        level: "log",
        source: "p",
        time: "10:00:01",
        args: [{ kind: "array", items: [] }],
      },
    ];
    render(<ConsoleEntryList entries={entries} />);
    const box = (text: string) => screen.getByText(text).getBoundingClientRect();
    const [first, second] = [box("10:00:00.120"), box("10:00:01")];
    const valueLeft = (index: number) =>
      (row(index).querySelector(".font-mono") as Element).getBoundingClientRect().left;
    expect({
      left: second.left - first.left,
      width: second.width - first.width,
      values: valueLeft(1) - valueLeft(0),
    }).toStrictEqual({ left: 0, width: 0, values: 0 });
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
    const debug = levelButton(/^debug/);
    const focused = document.activeElement === debug;
    await userEvent.keyboard(" ");
    const released = { pressed: debug.getAttribute("aria-pressed"), rows: rows().length };
    await userEvent.keyboard("{Enter}");
    const pressed = debug.getAttribute("aria-pressed");
    for (let i = 0; i < 5; i++) await userEvent.tab();
    await userEvent.keyboard("{Home}{ArrowDown}{ArrowDown}{Enter}");
    const root = treeItem(/^\{id: 42/);
    await userEvent.keyboard("{Enter}");
    const opened = root.getAttribute("aria-expanded");
    await userEvent.keyboard(" ");
    expect({
      focused,
      released,
      pressed,
      opened,
      closed: root.getAttribute("aria-expanded"),
    }).toStrictEqual({
      focused: true,
      released: { pressed: "false", rows: 6 },
      pressed: "true",
      opened: "true",
      closed: "false",
    });
  });

  it("行の領域で Tab のキーが止まるのは、一番新しい行の 1 か所だけにする", async () => {
    render(
      <>
        <Default />
        <button type="button">後</button>
      </>,
    );
    for (let i = 0; i < 6; i++) await userEvent.tab();
    const stop = document.activeElement;
    await userEvent.tab();
    expect({ stop: stop === row(6), next: document.activeElement?.textContent }).toStrictEqual({
      stop: true,
      next: "後",
    });
  });

  it("止まる行でない行の木の項目をクリックした後の Tab のキーは、一覧の外へ出る", async () => {
    render(
      <>
        <Default />
        <button type="button">後</button>
      </>,
    );
    await userEvent.click(treeItem(/^\{id: 42/));
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("後");
  });

  it("行で上下の矢印のキーを押すと前後の行へ、Home と End で端の行へ移る", async () => {
    render(<Default />);
    row(6).focus();
    const focused = async (keys: string) => {
      await userEvent.keyboard(keys);
      return rows().indexOf(document.activeElement as HTMLElement);
    };
    expect([
      await focused("{ArrowUp}"),
      await focused("{Home}"),
      await focused("{ArrowUp}"),
      await focused("{ArrowDown}"),
      await focused("{End}"),
      await focused("{ArrowDown}"),
    ]).toStrictEqual([5, 0, 0, 1, 6, 6]);
  });

  it("行で右の矢印のキーを押すと木へ入り、木の根で左の矢印のキーを押すと行へ戻る", async () => {
    render(<Default />);
    row(2).focus();
    await userEvent.keyboard("{ArrowRight}");
    const entered = document.activeElement === treeItem(/^\{id: 42/);
    await userEvent.keyboard("{ArrowLeft}");
    expect({ entered, back: document.activeElement === row(2) }).toStrictEqual({
      entered: true,
      back: true,
    });
  });

  it("1 行に木が 2 つあるとき、木の端の上下の矢印のキーで、隣の木、行、次の行へ移る", async () => {
    render(<Default />);
    row(5).focus();
    const map = treeItem(/^Map\(2\)/);
    const set = treeItem(/^Set\(2\)/);
    const at = async (keys: string) => {
      await userEvent.keyboard(keys);
      const active = document.activeElement;
      return active === map
        ? "map"
        : active === set
          ? "set"
          : rows().indexOf(active as HTMLElement);
    };
    expect([
      await at("{ArrowRight}"),
      await at("{ArrowDown}"),
      await at("{ArrowUp}"),
      await at("{ArrowUp}"),
      await at("{ArrowRight}{ArrowDown}{ArrowDown}"),
    ]).toStrictEqual(["map", "set", "map", 5, 6]);
  });

  it("開けない引数を挟んで木が並ぶ行でも、木の端の上下の矢印のキーで、隣の木と行へ移る", async () => {
    const text = (value: string): ConsoleValue => ({ kind: "string", value });
    render(
      <ConsoleEntryList
        entries={[
          {
            id: "a",
            level: "log",
            source: "server.js",
            args: [
              text("前"),
              { kind: "map", entries: [{ key: text("k"), value: text("v") }] },
              text("間"),
              { kind: "set", items: [text("s")] },
            ],
          },
        ]}
      />,
    );
    row(0).focus();
    const map = treeItem(/^Map\(1\)/);
    const set = treeItem(/^Set\(1\)/);
    const at = async (keys: string) => {
      await userEvent.keyboard(keys);
      const active = document.activeElement;
      return active === map
        ? "map"
        : active === set
          ? "set"
          : rows().indexOf(active as HTMLElement);
    };
    expect([
      await at("{ArrowRight}"),
      await at("{ArrowDown}"),
      await at("{ArrowUp}"),
      await at("{ArrowUp}"),
    ]).toStrictEqual(["map", "set", "map", 0]);
  });

  it("後の木の最初の項目で上の矢印のキーを押すと、開いた前の木の最後の項目へ移る", async () => {
    render(<Default />);
    row(5).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}{ArrowDown}");
    const onSet = document.activeElement === treeItem(/^Set\(2\)/);
    await userEvent.keyboard("{ArrowUp}");
    const [mapTree] = within(row(5)).getAllByRole("tree");
    const last = within(mapTree as HTMLElement)
      .getAllByRole("treeitem")
      .at(-1);
    expect({ onSet, onLast: document.activeElement === last }).toStrictEqual({
      onSet: true,
      onLast: true,
    });
  });

  it("止まる行が上限かフィルタで消えたら、一番新しい行を止まる箇所にする", async () => {
    render(<Default />);
    row(2).focus();
    await userEvent.click(levelButton(/^info/));
    expect(rows().map((item) => item.tabIndex)).toStrictEqual([-1, -1, -1, -1, -1, 0]);
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
    // 狭い幅では出力元が値の下へ折り返すので、1 行に収まる幅で描く
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

  it("起動を待つ間は、題だけを出し、ログレベルのボタンと行を出さない", () => {
    render(<Pending />);
    expect({
      title: screen.queryByText("コンソール") !== null,
      levels: screen.queryByRole("group", { name: "表示するログレベル" }),
      rows: screen.queryByRole("list"),
    }).toStrictEqual({ title: true, levels: null, rows: null });
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

  it("行と値の木の項目のフォーカスの輪は、要素の内側に引く（ADR-0066）", async () => {
    render(<Default />);
    row(2).focus();
    await userEvent.keyboard("{ArrowDown}");
    const ring = (element: Element) => [
      getComputedStyle(element).outlineStyle,
      getComputedStyle(element).outlineOffset,
    ];
    const rowRing = ring(row(3));
    await userEvent.keyboard("{ArrowUp}{ArrowRight}");
    expect({ row: rowRing, item: ring(treeItem(/^\{id: 42/)) }).toStrictEqual({
      row: ["solid", "-2px"],
      item: ["solid", "-2px"],
    });
  });
});
