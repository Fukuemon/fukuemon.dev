import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { fn } from "storybook/test";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Switch.stories";

const { Off, On, Disabled, OnDisabled } = composeStories(stories);

describe("Switch", () => {
  it("role=switch を持ち、ラベルが名前になる", () => {
    render(<Off />);
    expect(screen.getByRole("switch", { name: "AI からの操作を許可する" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("フォーカスして Space と Enter を押すと、aria-checked が切り替わる", async () => {
    const onCheckedChange = fn();
    render(<Off onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    await userEvent.tab();
    expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(control).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Enter}");
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true);
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false);
  });

  it("つまみの位置が、オンで右へ動く", async () => {
    render(<Off />);
    const control = screen.getByRole("switch");
    const thumb = control.firstElementChild as HTMLElement;
    const before = thumb.getBoundingClientRect().left;
    await userEvent.click(control);
    await expect.poll(() => thumb.getBoundingClientRect().left).toBeGreaterThan(before);
  });

  it("ラベルの文字をクリックしても切り替わる", async () => {
    render(<Off />);
    await userEvent.click(screen.getByText("AI からの操作を許可する"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("checked を渡すと、呼び出す側が状態を持つ", async () => {
    const onCheckedChange = fn();
    render(<On checked={false} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    expect(control).toHaveAttribute("aria-checked", "false");
    await userEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("無効のときは aria-disabled を付け、フォーカスを受けるが、切り替わらない", async () => {
    const onCheckedChange = fn();
    render(<Disabled onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    expect(control).toHaveAttribute("aria-disabled", "true");
    await userEvent.tab();
    expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    await userEvent.click(control, { force: true });
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("無効のときは、Enter とラベルの文字のクリックでも切り替わらず、onClick を呼ばない", async () => {
    const onClick = fn();
    render(<Disabled onClick={onClick} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByText("AI からの操作を許可する"), { force: true });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("オンの無効も切り替わらない", async () => {
    render(<OnDisabled />);
    await userEvent.click(screen.getByRole("switch"), { force: true });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("押せる領域が、44×44 px 以上ある", () => {
    render(<Off />);
    const rect = screen
      .getByText("AI からの操作を許可する")
      .closest("label")!
      .getBoundingClientRect();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    const control = screen.getByRole("switch").getBoundingClientRect();
    expect(control.width).toBeGreaterThanOrEqual(44);
  });

  it("キーボードでフォーカスすると、墨の 2 px の輪を出す", async () => {
    render(<Off />);
    await userEvent.tab();
    const style = getComputedStyle(screen.getByRole("switch"));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("オンのとき、つまみの中に印がある（色だけで伝えない）", () => {
    render(<On />);
    const svg = screen.getByRole("switch").querySelector("svg")!;
    expect(getComputedStyle(svg).display).not.toBe("none");
    render(<Off />);
    const off = screen.getAllByRole("switch")[1]!.querySelector("svg")!;
    expect(getComputedStyle(off).display).toBe("none");
  });

  it("オフのとき、hover で面の色を変える", async () => {
    render(<Off />);
    const control = screen.getByRole("switch");
    const before = getComputedStyle(control).backgroundColor;
    await userEvent.hover(screen.getByText("AI からの操作を許可する"));
    await expect.poll(() => getComputedStyle(control).backgroundColor).not.toBe(before);
  });
});
