import { expect, test, type Page } from "@playwright/test";

import { htmlElement } from "../../selectors/garden";
import { meanDiff } from "../../widgets/actions/mean-diff";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";
import { waitForPresentedFrames } from "../../widgets/waits/presented-frames";

// SwiftShader は場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
test.use({ viewport: { width: 960, height: 540 }, colorScheme: "light" });

const openGarden = async (
  page: Page,
  season: "summer" | "winter",
  time: "day" | "night",
): Promise<void> => {
  await seenBefore(page);
  await presetSettings(page, { motion: "on", season, time });
  await page.goto("/");
  await expect(htmlElement(page)).toHaveClass(/garden-ready/);
  // カメラが最初の和紙の前に着くまで待つ
  await waitForPresentedFrames(page, 60);
};

/** 舞う物が動けば変わる差。SwiftShader は同じ場面から同じ画素を描くので、止まっていれば 0 になる */
const diffAfterFrames = async (page: Page): Promise<number> => {
  const stage = page.getByTestId("garden-stage");
  const before = await stage.screenshot();
  await waitForPresentedFrames(page, 10);
  return meanDiff(page, before, await stage.screenshot());
};

test.describe("トップの庭の舞う物", () => {
  test("季節を冬、時間帯を夜にして開いた場合、雪が舞い続けること", async ({ page }) => {
    await openGarden(page, "winter", "night");
    expect(await diffAfterFrames(page)).toBeGreaterThan(0);
  });

  test("季節を夏、時間帯を昼にして開いた場合、舞う物が出ず、庭の絵が動かないこと", async ({
    page,
  }) => {
    await openGarden(page, "summer", "day");
    expect(await diffAfterFrames(page)).toBe(0);
  });

  test("季節を夏、時間帯を夜にして開いた場合、蛍が動き続けること", async ({ page }) => {
    await openGarden(page, "summer", "night");
    expect(await diffAfterFrames(page)).toBeGreaterThan(0);
  });

  test("雪が舞う庭で、表示の設定のアニメーションをオフにした場合、舞う物が止まること", async ({
    page,
  }) => {
    await openGarden(page, "winter", "night");
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-motion").click();
    await page.keyboard.press("Escape");
    await waitForPresentedFrames(page, 3);
    expect(await diffAfterFrames(page)).toBe(0);
  });
});
