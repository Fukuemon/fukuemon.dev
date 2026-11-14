import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Checkbox.stories";

const { Unchecked, Checked, Disabled, CheckedDisabled } = composeStories(stories);

describe("Checkbox", () => {
  it("ラベルが名前になる", () => {
    render(<Unchecked />);
    expect(screen.getByRole("checkbox", { name: "このページでは今後尋ねない" })).not.toBeChecked();
  });

  it("ラベルの文字をクリックすると、チェックが切り替わる", async () => {
    render(<Unchecked />);
    await userEvent.click(screen.getByText("このページでは今後尋ねない"));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("フォーカスして Space を押すと、チェックが切り替わる", async () => {
    render(<Checked />);
    await userEvent.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("無効のときは切り替わらず、フォーカスを受けない", async () => {
    render(<Disabled />);
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    await userEvent.tab();
    expect(box).not.toHaveFocus();
    await userEvent.click(screen.getByText("このページでは今後尋ねない"), { force: true });
    expect(box).not.toBeChecked();
  });

  it("押せる領域が、見出しを含めて 44 px 以上の高さがある", () => {
    render(<Unchecked />);
    const rect = screen
      .getByText("このページでは今後尋ねない")
      .closest("label")!
      .getBoundingClientRect();
    expect(rect.height).toBeGreaterThanOrEqual(44);
  });

  it("キーボードでフォーカスすると、墨の 2 px の輪を出す", async () => {
    render(<Unchecked />);
    await userEvent.tab();
    const style = getComputedStyle(screen.getByRole("checkbox"));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("チェックありのとき、印（チェックマーク）を出す", () => {
    render(<Checked />);
    const svg = screen.getByRole("checkbox").nextElementSibling as SVGElement;
    expect(getComputedStyle(svg).display).not.toBe("none");
  });

  it("チェックありの無効は、クリックしてもチェックが外れない", async () => {
    render(<CheckedDisabled />);
    await userEvent.click(screen.getByText("このページでは今後尋ねない"), { force: true });
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("チェックなしのとき、印を出さない", () => {
    render(<Unchecked />);
    const svg = screen.getByRole("checkbox").nextElementSibling as SVGElement;
    expect(getComputedStyle(svg).display).toBe("none");
  });

  it("チェックなしのとき、hover で面の色を変える", async () => {
    render(<Unchecked />);
    const box = screen.getByRole("checkbox");
    const before = getComputedStyle(box).backgroundColor;
    await userEvent.hover(box);
    await expect.poll(() => getComputedStyle(box).backgroundColor).not.toBe(before);
  });
});
