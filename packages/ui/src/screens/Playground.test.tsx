import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Playground.stories";

const { Default, LongData } = composeStories(stories);

const rectOf = (name: string) => screen.getByRole("region", { name }).getBoundingClientRect();

// 48rem（768px）のブレークポイントの前後と、狭い画面の最小の幅で確かめる
describe("コードを動かす画面", () => {
  it.each([320, 767])(
    "幅 %ipx（48rem 未満）では、ページが横にはみ出さず、領域が縦に並ぶ（LAYOUT-OVERFLOW）",
    async (width) => {
      await page.viewport(width, 900);
      render(<LongData />);
      const root = document.documentElement;
      expect(root.clientWidth).toBe(width);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      expect(rectOf("ファイル").bottom).toBeLessThanOrEqual(rectOf("エディタ").top);
      expect(rectOf("端末").bottom).toBeLessThanOrEqual(rectOf("プレビュー").top);
    },
  );

  it.each([768, 1280])(
    "幅 %ipx（48rem 以上）では、ページが横にはみ出さず、領域が横に並ぶ（LAYOUT-OVERFLOW）",
    async (width) => {
      await page.viewport(width, 900);
      render(<LongData />);
      const root = document.documentElement;
      expect(root.clientWidth).toBe(width);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      expect(rectOf("ファイル").right).toBeLessThanOrEqual(rectOf("エディタ").left);
      expect(rectOf("エディタ").right).toBeLessThanOrEqual(rectOf("プレビュー").left);
    },
  );

  it("幅 1280px では、ファイルの枠が端末の下端まで伸び、エディタが端末の上に余白なく続く", async () => {
    await page.viewport(1280, 900);
    render(<LongData />);
    expect(Math.abs(rectOf("ファイル").bottom - rectOf("端末").bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectOf("エディタ").bottom + 16 - rectOf("端末").top)).toBeLessThanOrEqual(1);
  });

  it("幅 1280px、高さ 900px では、右の列が長くても、端末が最初の画面に収まる", async () => {
    await page.viewport(1280, 900);
    render(<LongData />);
    expect(rectOf("端末").bottom).toBeLessThanOrEqual(900);
    expect(rectOf("エディタ").height).toBeLessThan(450);
  });

  it("ファイルの削除を選ぶと確認のダイアログを出し、やめると木に残り、確定すると木から消える", async () => {
    await page.viewport(1280, 900);
    render(<Default />);
    const tree = screen.getByRole("tree", { name: "ファイル" });
    const openMenu = () =>
      userEvent.click(screen.getByRole("button", { name: "server.js の操作" }));

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    const dialog = screen.getByRole("dialog", { name: "server.js を削除する" });
    expect(dialog).toHaveTextContent("src/server.js を削除する。");
    await userEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.getByRole("button", { name: "server.js の操作" })).toHaveFocus();
    expect(screen.getByRole("treeitem", { name: "server.js" })).toBeVisible();

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tree).not.toHaveTextContent("server.js");
  });
});
