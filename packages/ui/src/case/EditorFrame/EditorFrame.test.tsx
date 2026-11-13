import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./EditorFrame.stories";

const { Default, Closable, Empty, Error } = composeStories(stories);

describe("EditorFrame", () => {
  it("選んだファイルのエンジンに、テーマの名前のテーマとファイルを渡す", () => {
    render(<Default themeName="dark" />);
    const engine = screen.getByRole("region", { name: "server.js のコード" });
    expect(engine).toHaveAttribute("data-code-theme", "dark");
  });

  it("タブの次の Tab のキーで、パネルを飛ばしてエンジンへ移る", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("tab", { name: "server.js" }));
    await userEvent.tab();
    expect(screen.getByRole("region", { name: "server.js のコード" })).toHaveFocus();
  });

  it("タブを押すと、そのファイルのエンジンに替わる", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("tab", { name: "package.json" }));
    expect(screen.getByRole("region", { name: "package.json のコード" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "server.js のコード" })).toBeNull();
  });

  it("タブは 32 px の高さと 13 px の文字で押せ、閉じられるタブは Delete のキーで閉じる（ADR-0062 の 28 px 以上）", async () => {
    render(<Closable />);
    const tab = screen.getByRole("tab", { name: "server.js" });
    expect(tab.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(tab).fontSize).toBe("13px");
    tab.focus();
    await userEvent.keyboard("{Delete}");
    expect(screen.queryByRole("tab", { name: "server.js" })).toBeNull();
  });

  it("コードの字句を 6 種以上の色で分け、長い行の右に 16px の余白を残す", () => {
    render(<Default />);
    const engine = screen.getByRole("region", { name: "server.js のコード" });
    const colors = new Set(
      [...engine.querySelectorAll("code > span > span:not([data-indent-guide])")].map(
        (span) => getComputedStyle(span).color,
      ),
    );
    expect(colors.size).toBeGreaterThanOrEqual(6);
    const line = engine.querySelector("code > span");
    expect(line && getComputedStyle(line).paddingRight).toBe("16px");
  });

  it("選んだタブの下の罫を引く動きと、ファイルの印を出し、status を下の帯に出す", () => {
    render(<Default status="JavaScript" />);
    const tab = screen.getByRole("tab", { name: "server.js" });
    const underline = tab.parentElement?.querySelector("span[aria-hidden]");
    expect(underline && getComputedStyle(underline).animationName).toBe("fd-draw-stroke");
    expect(tab.querySelector("[data-icon]")).toHaveAttribute("data-icon", "code");
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(
      screen
        .getByRole("tab", { name: "package.json" })
        .parentElement?.querySelector("span[aria-hidden]"),
    ).toBeNull();
  });

  it("ファイルが無いときは案内を出し、エラーではエンジンを描かない", () => {
    const { unmount } = render(<Empty />);
    expect(screen.getByText("ファイルを選ぶと、ここに開きます。")).toBeInTheDocument();
    unmount();
    render(<Error />);
    expect(screen.getByRole("alert")).toHaveTextContent("エディタを読み込めませんでした");
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
