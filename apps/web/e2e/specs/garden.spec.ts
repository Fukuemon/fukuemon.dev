import { expect, test } from "@playwright/test";

// 秋の昼。季節と時間帯は、端末の日付と時刻で決まる
const AUTUMN_NOON = new Date(2026, 10, 13, 12);

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

test("秋の昼のトップを開くと、止めた庭の絵が基準の画像と同じに出る", async ({ page }) => {
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  const stage = page.locator("[data-garden-stage]");
  // 庭は、描く直前に canvas の大きさを画面に合わせる
  await expect(stage.locator("canvas")).toHaveJSProperty("width", 1440);
  await expect(stage).toHaveScreenshot("garden-autumn-day.png", { maxDiffPixelRatio: 0.01 });
});
