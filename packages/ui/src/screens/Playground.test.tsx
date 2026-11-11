import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";

import * as stories from "./Playground.stories";

const { LongData } = composeStories(stories);

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
});
