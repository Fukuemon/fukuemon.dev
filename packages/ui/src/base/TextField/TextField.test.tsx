import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./TextField.stories";

const { WithDescription, Error, LabelHidden, Underline } = composeStories(stories);

describe("TextField", () => {
  it("見出しを名前にし、補足を説明に結ぶ。欄は 44 px 以上の高さで押せる", () => {
    render(<WithDescription />);
    const input = screen.getByRole("textbox", { name: /リダイレクト先の URL/ });
    expect(input).toHaveAccessibleDescription("認可サーバーに登録した URL と同じにする");
    expect(input).toBeRequired();
    expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it("誤りがあれば欄を aria-invalid にし、誤りの文を説明に結ぶ。role=alert は付けない", () => {
    render(<Error />);
    const input = screen.getByRole("textbox", { name: "リダイレクト先の URL" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("https:// で始まる URL を入れる");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("isLabelHidden のときは、見出しを名前に残したまま画面に出さない", () => {
    render(<LabelHidden />);
    const label = screen.getByText("リダイレクト先の URL");
    expect(screen.getByRole("textbox", { name: "リダイレクト先の URL" })).toBeVisible();
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  it("underline の欄は、枠を持たず墨の 1px の下罫だけを引く。hover で 2px になる", async () => {
    const { container } = render(<Underline />);
    const input = screen.getByRole("textbox");
    const style = getComputedStyle(input);
    expect(style.borderTopWidth).toBe("0px");
    expect(style.borderBottomWidth).toBe("0px");
    expect(style.boxShadow).toBe("none");
    const [rule] = container.querySelectorAll("span[aria-hidden]");
    expect(rule.getBoundingClientRect().height).toBe(1);
    expect(getComputedStyle(rule).backgroundColor).toBe(getComputedStyle(input).color);
    await userEvent.hover(input);
    expect(rule.getBoundingClientRect().height).toBe(2);
  });

  it("underline の案内の文は明朝で、入力した文字とは別の色（text-secondary）になる", () => {
    render(<Underline />);
    const placeholder = getComputedStyle(screen.getByRole("textbox"), "::placeholder");
    expect(placeholder.fontFamily).toContain("Zen Old Mincho");
    expect(placeholder.color).not.toBe(getComputedStyle(screen.getByRole("textbox")).color);
  });

  it("underline の欄は、フォーカスすると緑の筆の線が引かれ、標準の輪を出さない", async () => {
    const { container } = render(<Underline />);
    const input = screen.getByRole("textbox");
    const stroke = container.querySelectorAll("span[aria-hidden]")[1];
    expect(getComputedStyle(stroke).visibility).toBe("hidden");
    await userEvent.click(input);
    const style = getComputedStyle(stroke);
    expect(style.visibility).toBe("visible");
    expect(style.animationName).toBe("fd-draw-stroke");
    expect(style.maskImage).not.toBe("none");
    const primary = document.body.appendChild(document.createElement("span"));
    primary.className = "bg-primary";
    expect(style.backgroundColor).toBe(getComputedStyle(primary).backgroundColor);
    primary.remove();
    expect(stroke.getBoundingClientRect().height).toBe(4);
    expect(getComputedStyle(input).outlineStyle).toBe("none");
    expect(getComputedStyle(input).boxShadow).toBe("none");
  });
});
