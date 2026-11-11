import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

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

  it("underline の欄は、下の 1 辺だけに枠を引き、4 辺の枠を出さない", () => {
    render(<Underline />);
    const style = getComputedStyle(screen.getByRole("textbox"));
    expect(style.borderBottomWidth).toBe("1px");
    expect(style.borderTopWidth).toBe("0px");
    expect(style.boxShadow).toBe("none");
  });
});
