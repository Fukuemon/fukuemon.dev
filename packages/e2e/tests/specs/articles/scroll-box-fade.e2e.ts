import { expect, test, type Locator } from "@playwright/test";

import { scrollToRatio } from "../../widgets/actions/scroll-to-ratio";
import { figure, longCode, shortCode, smallTable, wideTable } from "../../selectors/article-body";

// ぼかしは CSS の scroll-driven animation だけで出し分けるので、ブラウザで描かないと確かめられない
const fadeOpacity = (box: Locator) =>
  box.evaluate((el) => Number(getComputedStyle(el, "::after").opacity));

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/articles/article-elements/body-and-figure/");
});

test.describe("記事のページ", () => {
  test.describe("表と図とコードブロックの右端のぼかし", () => {
    test("本文の列に収まる表の場合、右端のぼかしを出さないこと", async ({ page }) => {
      await expect.poll(() => fadeOpacity(smallTable(page))).toBe(0);
    });

    test("本文の列に収まるコードブロックの場合、右端のぼかしを出さないこと", async ({ page }) => {
      await expect.poll(() => fadeOpacity(shortCode(page))).toBe(0);
    });

    for (const [name, box] of [
      ["列の多い表", wideTable],
      ["横に長い図", figure],
      ["横に長いコードブロック", longCode],
    ] as const) {
      test(`${name}を送る前の場合、右端のぼかしを出すこと`, async ({ page }) => {
        await expect.poll(() => fadeOpacity(box(page))).toBe(1);
      });

      test(`${name}を右端まで送った場合、ぼかしを消すこと`, async ({ page }) => {
        await scrollToRatio(box(page), 1);
        await expect.poll(() => fadeOpacity(box(page))).toBe(0);
      });
    }

    test("横に長いコードブロックの場合、ぼかしがコードブロックの背景と同じ色で終わること", async ({
      page,
    }) => {
      const pre = longCode(page);
      const background = await pre.evaluate((el) => getComputedStyle(el).backgroundColor);
      const gradient = await pre.evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
      expect(gradient).toContain(background);
    });

    test("列の多い表を右端の手前まで送った場合、ぼかしを薄くし始めること", async ({ page }) => {
      await scrollToRatio(wideTable(page), 0.95);
      const opacity = await fadeOpacity(wideTable(page));
      expect(opacity > 0 && opacity < 1).toBe(true);
    });

    test.describe("動きを減らす設定", () => {
      test.use({ reducedMotion: "reduce" });

      test("列の多い表を右端の手前まで送った場合、ぼかしを薄くしないこと", async ({ page }) => {
        await scrollToRatio(wideTable(page), 0.95);
        await expect.poll(() => fadeOpacity(wideTable(page))).toBe(1);
      });

      test("列の多い表を右端まで送った場合、ぼかしを一度に消すこと", async ({ page }) => {
        await scrollToRatio(wideTable(page), 1);
        await expect.poll(() => fadeOpacity(wideTable(page))).toBe(0);
      });
    });
  });
});
