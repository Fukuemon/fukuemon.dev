import { expect, test, type Browser, type Page } from "@playwright/test";
import { meanDiff } from "../support/mean-diff";
import { seenBefore } from "../support/visit";

// 秋の昼。季節と時間帯は、端末の日付と時刻で決まる
const AUTUMN_NOON = new Date(2026, 10, 13, 12);
const VIEWPORT = { width: 1440, height: 900 };

const openGarden = async (browser: Browser, colorScheme: "light" | "dark") => {
  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme });
  await seenBefore(page);
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  await page.waitForFunction(
    (w) => document.querySelector<HTMLCanvasElement>("[data-garden-stage] canvas")?.width === w,
    VIEWPORT.width,
  );
  return page;
};

const shoot = (page: Page) => page.locator("[data-garden-stage]").screenshot();

test("ライトで開いた後に OS のテーマをダークにすると、庭がダークで開いたときと同じ色で描き直される", async ({
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
