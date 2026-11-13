import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./TextField.stories";

const { Default, WithDescription, Error, Disabled, LabelHidden, Underline } =
  composeStories(stories);

const colorOf = (className: string) => {
  render(<span className={className} data-testid={className} />);
  return getComputedStyle(screen.getByTestId(className)).color;
};

/** boxed の欄の後ろに重ねた、面と下罫の要素。 */
const faceOf = (input: HTMLElement) => input.nextElementSibling as HTMLElement;

describe("TextField", () => {
  it("見出しを名前にし、補足を説明に結ぶ。欄は 44 px 以上の高さで押せる", () => {
    render(<WithDescription />);
    const input = screen.getByRole("textbox", { name: /リダイレクト先の URL/ });
    expect(input).toHaveAccessibleDescription("認可サーバーに登録した URL と同じにする");
    expect(input).toBeRequired();
    expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it("boxed の欄は、4 辺の枠を持たず、40 px の薄い面と 1 px の下罫で示す", () => {
    render(<Default />);
    const input = screen.getByRole("textbox", { name: "リダイレクト先の URL" });
    const face = faceOf(input);
    const style = getComputedStyle(face);
    expect(face.getBoundingClientRect().height).toBe(40);
    expect(style.borderTopWidth).toBe("0px");
    expect(style.borderLeftWidth).toBe("0px");
    expect(style.borderRightWidth).toBe("0px");
    expect(style.borderBottomWidth).toBe("1px");
    expect(style.borderBottomColor).toBe(colorOf("text-border-field"));
    expect(style.backgroundColor).toBe(colorOf("text-surface-subtle"));
    expect(getComputedStyle(input).boxShadow).toBe("none");
  });

  it("boxed の欄は、面の上下の 1 px 外を押しても欄にフォーカスが移る", async () => {
    render(<Default />);
    const input = screen.getByRole("textbox", { name: "リダイレクト先の URL" });
    const rect = faceOf(input).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    expect(document.elementFromPoint(x, rect.top - 1)).toBe(input);
    expect(document.elementFromPoint(x, rect.bottom + 1)).toBe(input);
    await userEvent.click(input, { position: { x: rect.width / 2, y: 1 } });
    expect(input).toHaveFocus();
  });

  it("boxed の欄は、キーボードでフォーカスすると面に墨の 2 px の輪を出す", async () => {
    render(<Default />);
    const input = screen.getByRole("textbox", { name: "リダイレクト先の URL" });
    await userEvent.tab();
    expect(input).toHaveFocus();
    const style = getComputedStyle(faceOf(input));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(style.outlineOffset).toBe("2px");
    expect(style.outlineColor).toBe(colorOf("text-text"));
  });

  it("boxed の欄は、誤りがあると下罫を赤の 2 px にする", () => {
    render(<Error />);
    const style = getComputedStyle(
      faceOf(screen.getByRole("textbox", { name: "リダイレクト先の URL" })),
    );
    expect(style.borderBottomWidth).toBe("2px");
    expect(style.borderBottomColor).toBe(colorOf("text-danger"));
  });

  it("boxed の欄は、無効のときに面を無効の色にし、下罫を飾りの罫の色に替える", () => {
    render(<Disabled />);
    const style = getComputedStyle(
      faceOf(screen.getByRole("textbox", { name: "リダイレクト先の URL" })),
    );
    render(<span className="bg-surface-disabled" data-testid="disabled" />);
    expect(style.backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("disabled")).backgroundColor,
    );
    expect(style.borderBottomColor).toBe(colorOf("text-border"));
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
