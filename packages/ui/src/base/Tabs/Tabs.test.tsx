import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Tabs.stories";

const { Closable, Fixed } = composeStories(stories);

describe("Tabs", () => {
  it("左右の矢印のキーで隣のタブへ移って選び、端から反対の端へ回る", async () => {
    render(<Fixed />);
    await userEvent.click(screen.getByRole("tab", { name: "ヘッダ" }));
    await userEvent.keyboard("{ArrowRight}");
    const body = screen.getByRole("tab", { name: "本文" });
    expect(body).toHaveFocus();
    expect(body).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("本文");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Cookie" })).toHaveFocus();
  });

  it("Home と End で端のタブへ移る。選んでいないタブは Tab のキーの順に入らない", async () => {
    render(<Fixed />);
    await userEvent.click(screen.getByRole("tab", { name: "ヘッダ" }));
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Cookie" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "ヘッダ" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "本文" })).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("閉じられるタブは、Delete のキーで閉じ、隣のタブを選ぶ", async () => {
    render(<Closable />);
    const first = screen.getByRole("tab", { name: "index.ts" });
    expect(first).toHaveAttribute("aria-keyshortcuts", "Delete");
    await userEvent.click(first);
    await userEvent.keyboard("{Delete}");
    expect(screen.queryByRole("tab", { name: "index.ts" })).toBeNull();
    expect(screen.getByRole("tab", { name: "server.ts" })).toHaveAttribute("aria-selected", "true");
  });

  it("閉じるボタンを押すとタブを閉じる。タブと閉じるボタンは 44 px の高さで押せる", async () => {
    const { container } = render(<Closable />);
    const tab = screen.getByRole("tab", { name: "server.ts" });
    const close = container.querySelector<HTMLButtonElement>('[aria-label="server.ts を閉じる"]');
    expect(close).not.toBeNull();
    expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    const rect = close!.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    await userEvent.click(close!);
    expect(screen.queryByRole("tab", { name: "server.ts" })).toBeNull();
  });
});
