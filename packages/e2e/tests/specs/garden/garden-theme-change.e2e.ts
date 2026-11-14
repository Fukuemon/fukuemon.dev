import { expect, test, type Browser, type Page } from "@playwright/test";

import { waitForGardenCanvasWidth } from "../../widgets/waits/canvas-width";
import { meanDiff } from "../../widgets/actions/mean-diff";

// 秋の昼。季節と時間帯は、端末の日付と時刻で決まる
const AUTUMN_NOON = new Date(2026, 10, 13, 12);
const VIEWPORT = { width: 1440, height: 900 };

const openGarden = async (browser: Browser, colorScheme: "light" | "dark") => {
  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme });
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  await waitForGardenCanvasWidth(page, VIEWPORT.width);
  return page;
};

const shoot = (page: Page) => page.getByTestId("garden-stage").screenshot();

test.describe("トップの庭", () => {
  test.describe("テーマの変更", () => {
    test("ライトで開いた後に OS のテーマをダークにした場合、庭がダークで開いたときと同じ色で描き直されること", async ({
      browser,
    }) => {
      const page = await openGarden(browser, "light");
      const light = await shoot(page);
      await page.emulateMedia({ colorScheme: "dark" });
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const switched = await shoot(page);

      const darkPage = await openGarden(browser, "dark");
      const dark = await shoot(darkPage);

      expect(await meanDiff(page, light, switched)).toBeGreaterThan(20);
      expect(await meanDiff(page, dark, switched)).toBeLessThan(1);
    });
  });
});
