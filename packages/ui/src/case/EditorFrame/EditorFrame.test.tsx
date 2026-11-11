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

  it("タブを押すと、そのファイルのエンジンに替わる", async () => {
    render(<Default />);
    await userEvent.click(screen.getByRole("tab", { name: "package.json" }));
    expect(screen.getByRole("region", { name: "package.json のコード" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "server.js のコード" })).toBeNull();
  });

  it("タブは 44 px 以上の高さで押せ、閉じられるタブは Delete のキーで閉じる", async () => {
    render(<Closable />);
    const tab = screen.getByRole("tab", { name: "server.js" });
    expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    tab.focus();
    await userEvent.keyboard("{Delete}");
    expect(screen.queryByRole("tab", { name: "server.js" })).toBeNull();
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
