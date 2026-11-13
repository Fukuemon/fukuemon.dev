import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Playground.stories";

const { Default, LongData } = composeStories(stories);

const rectOf = (name: string) => screen.getByRole("region", { name }).getBoundingClientRect();

// 48rem（768px）のブレークポイントの前後と、狭い画面の最小の幅で確かめる。隣り合う領域は罫を 1px 重ねる
describe("コードを動かす画面", () => {
  it.each([320, 767])(
    "幅 %ipx（48rem 未満）では、ページが横にはみ出さず、領域が縦に並ぶ（LAYOUT-OVERFLOW）",
    async (width) => {
      await page.viewport(width, 900);
      render(<LongData />);
      const root = document.documentElement;
      expect(root.clientWidth).toBe(width);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      expect(rectOf("ファイル").bottom).toBeLessThanOrEqual(rectOf("エディタ").top + 1);
      expect(rectOf("端末").bottom).toBeLessThanOrEqual(rectOf("プレビュー").top + 1);
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
      expect(rectOf("ファイル").right).toBeLessThanOrEqual(rectOf("エディタ").left + 1);
      expect(rectOf("エディタ").right).toBeLessThanOrEqual(rectOf("プレビュー").left + 1);
    },
  );

  it("幅 1280px では、ファイルの枠が端末の下端まで伸び、領域の間に隙間を空けない", async () => {
    await page.viewport(1280, 900);
    render(<LongData />);
    expect(Math.abs(rectOf("ファイル").bottom - rectOf("端末").bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectOf("エディタ").bottom - rectOf("端末").top)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectOf("ファイル").right - rectOf("エディタ").left)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectOf("エディタ").right - rectOf("プレビュー").left)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectOf("プレビュー").bottom - rectOf("HTTP の流れ").top)).toBeLessThanOrEqual(
      1,
    );
  });

  it("幅 1280px では、隣り合う領域の罫を 1px 重ね、右の列の左の罫を端末より下の領域でも引く", async () => {
    await page.viewport(1280, 900);
    render(<LongData />);
    // 領域は四方に 1px の罫を引き、左と上へ 1px ずらすので、隣の領域の罫と同じ位置に重なる
    expect(rectOf("エディタ").bottom - rectOf("端末").top).toBe(1);
    expect(rectOf("エディタ").right - rectOf("プレビュー").left).toBe(1);
    const consolePane = screen.getByRole("region", { name: "コンソール" });
    expect(consolePane.getBoundingClientRect().top).toBeGreaterThan(rectOf("端末").bottom);
    expect(getComputedStyle(consolePane).borderLeftWidth).toBe("1px");
    expect(consolePane.getBoundingClientRect().left).toBe(rectOf("プレビュー").left);
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
