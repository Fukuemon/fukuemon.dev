import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { cdp, userEvent } from "vite-plus/test/browser/context";

import * as buttonStories from "../base/Button/Button.stories";
import * as checkboxStories from "../base/Checkbox/Checkbox.stories";
import * as splitPaneStories from "../base/SplitPane/SplitPane.stories";
import * as switchStories from "../base/Switch/Switch.stories";
import * as tabsStories from "../base/Tabs/Tabs.stories";
import * as treeViewStories from "../base/TreeView/TreeView.stories";

const { Primary, PrimaryDisabled } = composeStories(buttonStories);
const { Unchecked, Checked, CheckedDisabled } = composeStories(checkboxStories);
const { Horizontal } = composeStories(splitPaneStories);
const { Off, On, OnDisabled } = composeStories(switchStories);
const { Closable } = composeStories(tabsStories);
const { CompactBody } = composeStories(treeViewStories);

const setForcedColors = (value: "active" | "none") =>
  cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value }] });

const style = (element: Element) => getComputedStyle(element);

// ハイコントラストでは、ブラウザが背景の色と ring を消す。状態を、枠と塗りの違いで見分けられることを確認する
describe("forced-colors: active", () => {
  beforeEach(() => setForcedColors("active"));
  afterEach(() => setForcedColors("none"));

  it("Switch は、オフとオンとオンの無効で、枠の中の塗りが違う", () => {
    const track = (ui: React.ReactElement) => {
      const { unmount } = render(ui);
      const control = screen.getByRole("switch");
      const result = {
        borderWidth: style(control).borderTopWidth,
        trackBackground: style(control).backgroundColor,
        thumbBackground: style(control.firstElementChild as Element).backgroundColor,
      };
      unmount();
      return result;
    };
    const off = track(<Off />);
    const on = track(<On />);
    const onDisabled = track(<OnDisabled />);
    expect(off.borderWidth).toBe("1px");
    expect(on.trackBackground).not.toBe(off.trackBackground);
    expect(on.thumbBackground).not.toBe(on.trackBackground);
    expect(off.thumbBackground).not.toBe(off.trackBackground);
    expect(onDisabled.trackBackground).not.toBe(on.trackBackground);
  });

  it("Checkbox は、オフに枠があり、オンと無効のオンで塗りが違い、印は塗りと違う色である", () => {
    const box = (ui: React.ReactElement) => {
      const { unmount } = render(ui);
      const input = screen.getByRole("checkbox");
      const mark = input.nextElementSibling as Element;
      const result = {
        borderWidth: style(input).borderTopWidth,
        background: style(input).backgroundColor,
        mark: style(mark).color,
      };
      unmount();
      return result;
    };
    const unchecked = box(<Unchecked />);
    const checked = box(<Checked />);
    const checkedDisabled = box(<CheckedDisabled />);
    expect(unchecked.borderWidth).toBe("1px");
    expect(checked.background).not.toBe(unchecked.background);
    expect(checked.mark).not.toBe(checked.background);
    expect(checkedDisabled.background).not.toBe(checked.background);
    expect(checkedDisabled.mark).not.toBe(checkedDisabled.background);
  });

  it("Button は、有効と無効のどちらにも枠があり、枠の色が違う", () => {
    const frame = (ui: React.ReactElement) => {
      const { unmount } = render(ui);
      const button = screen.getByRole("button");
      const result = { width: style(button).borderTopWidth, color: style(button).borderTopColor };
      unmount();
      return result;
    };
    const enabled = frame(<Primary />);
    const disabled = frame(<PrimaryDisabled />);
    expect(enabled.width).toBe("1px");
    expect(disabled.width).toBe("1px");
    expect(disabled.color).not.toBe(enabled.color);
  });

  it("Tabs は、選んだタブの下に帯が出て、帯が背景と違う色で塗られる", () => {
    render(<Closable />);
    const selected = screen.getByRole("tab", { selected: true });
    const indicator = selected.previousElementSibling as Element;
    expect(style(indicator).backgroundColor).not.toBe(style(document.body).backgroundColor);
  });

  it("TreeView は、選んだ項目の塗りが、選んでいない項目と違い、選んでいない項目の左の枠は背景に溶ける", () => {
    render(<CompactBody />);
    const items = screen.getAllByRole("treeitem");
    const selected = items.find((item) => item.getAttribute("aria-selected") === "true") as Element;
    const other = items.find((item) => item.getAttribute("aria-selected") === "false") as Element;
    expect(style(selected).backgroundColor).not.toBe(style(other).backgroundColor);
    expect(style(other).borderLeftColor).toBe(style(document.body).backgroundColor);
    expect(style(selected).borderLeftColor).not.toBe(style(document.body).backgroundColor);
  });

  it("SplitPane の区切りの線が、背景と違う色で塗られる", () => {
    render(<Horizontal />);
    const line = screen.getByRole("separator").firstElementChild as Element;
    expect(style(line).backgroundColor).not.toBe(style(document.body).backgroundColor);
  });

  it("Tab のキーでフォーカスを受けた要素に、フォーカスの輪が出る", async () => {
    const focused = async (ui: React.ReactElement, role: string) => {
      const { unmount } = render(ui);
      await userEvent.tab();
      const element = screen.getByRole(role, { selected: role === "tab" ? true : undefined });
      expect(element).toHaveFocus();
      const outline = style(element);
      const result = { style: outline.outlineStyle, width: outline.outlineWidth };
      unmount();
      return result;
    };
    for (const [ui, role] of [
      [<Off key="switch" />, "switch"],
      [<Checked key="checkbox" />, "checkbox"],
      [<Primary key="button" />, "button"],
      [<Closable key="tabs" />, "tab"],
    ] as const) {
      expect(await focused(ui, role), role).toEqual({ style: "solid", width: "2px" });
    }
  });
});
