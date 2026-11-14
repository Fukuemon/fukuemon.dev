import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as actionMenu from "../base/ActionMenu/ActionMenu.stories";
import * as button from "../base/Button/Button.stories";
import * as disclosure from "../base/Disclosure/Disclosure.stories";
import * as iconButton from "../base/IconButton/IconButton.stories";
import * as splitPane from "../base/SplitPane/SplitPane.stories";
import * as tabs from "../base/Tabs/Tabs.stories";
import * as textField from "../base/TextField/TextField.stories";
import * as treeView from "../base/TreeView/TreeView.stories";
import * as consoleEntryList from "../case/ConsoleEntryList/ConsoleEntryList.stories";
import * as editorFrame from "../case/EditorFrame/EditorFrame.stories";
import * as fileTree from "../case/FileTree/FileTree.stories";
import * as httpExchangeList from "../case/HttpExchangeList/HttpExchangeList.stories";
import * as previewFrame from "../case/PreviewFrame/PreviewFrame.stories";

const TARGETS =
  "button, a[href], input, summary, [role=tab], [role=treeitem], [role=menuitem], [role=separator][tabindex]";

/** 見えている押せる要素の数と、そのうち幅か高さが 44px に届かないものの名前と大きさを返す。 */
const measureTargets = (root: ParentNode) => {
  const visible = [...root.querySelectorAll(TARGETS)].filter((element) => {
    const { width, height } = element.getBoundingClientRect();
    return width > 0 || height > 0;
  });
  const small = visible.flatMap((element) => {
    const { width, height } = element.getBoundingClientRect();
    if (width >= 44 && height >= 44) return [];
    const name = element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
    return [`${element.tagName.toLowerCase()} ${name} ${Math.round(width)}x${Math.round(height)}`];
  });
  return { hasTargets: visible.length > 0, small };
};

const cases: [string, ComponentType][] = [
  ["Button の XS", composeStories(button).ExtraSmall],
  ["IconButton の compact", composeStories(iconButton).Compact],
  ["TreeView の compact", composeStories(treeView).Compact],
  ["TreeView の body-compact", composeStories(treeView).CompactBody],
  ["Disclosure の compact", composeStories(disclosure).Compact],
  ["TextField の compact", composeStories(textField).Compact],
  ["ActionMenu の compact", composeStories(actionMenu).Compact],
  ["Tabs の compact", composeStories(tabs).Compact],
  ["ConsoleEntryList", composeStories(consoleEntryList).Default],
  ["HttpExchangeList", composeStories(httpExchangeList).Default],
  ["FileTree", composeStories(fileTree).Default],
  ["EditorFrame", composeStories(editorFrame).Closable],
  ["PreviewFrame", composeStories(previewFrame).Default],
  ["SplitPane の左右の仕切り", composeStories(splitPane).Horizontal],
  ["SplitPane の上下の仕切り", composeStories(splitPane).Vertical],
];

// 触る端末（pointer: coarse）では、コードを動かす画面の押せる要素を全て 44×44 CSS px 以上にする（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）
describe("触る端末の押せる領域", () => {
  it("この project は pointer: coarse で描く", () => {
    expect(matchMedia("(pointer: coarse)").matches).toBe(true);
  });

  it.each(cases)("%s の押せる要素は 44×44 px 以上で押せる", (_, Story) => {
    const { container } = render(<Story />);
    expect(measureTargets(container)).toStrictEqual({ hasTargets: true, small: [] });
  });

  it("ActionMenu の compact の項目は 44 px の高さで押せる", async () => {
    const { Compact } = composeStories(actionMenu);
    render(<Compact />);
    await userEvent.click(screen.getByRole("button"));
    expect(measureTargets(screen.getByRole("menu"))).toStrictEqual({ hasTargets: true, small: [] });
  });

  it("FileTree の名前の欄は 44 px の高さで押せ、行の高さは 44 px のままにする", async () => {
    const { Default } = composeStories(fileTree);
    render(<Default />);
    screen.getByRole("treeitem", { name: "server.js" }).focus();
    await userEvent.keyboard("{F2}");
    const input = screen.getByRole("textbox");
    expect(input.getBoundingClientRect().height).toBe(44);
    expect(input.closest("[role=treeitem]")?.getBoundingClientRect().height).toBe(44);
  });

  it("ペインの見出しの帯は 44 px の高さにする", () => {
    const { Closable } = composeStories(editorFrame);
    render(<Closable />);
    const band = screen.getAllByRole("heading", { level: 2 })[0].parentElement!;
    expect(band.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});
