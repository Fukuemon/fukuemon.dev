import { expect, test, type Page } from "@playwright/test";

import { currentCards, htmlElement } from "../../selectors/garden";
import { meanDiff } from "../../widgets/actions/mean-diff";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";
import { waitForPresentedFrames } from "../../widgets/waits/presented-frames";

// SwiftShader は場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
test.use({ viewport: { width: 960, height: 540 }, colorScheme: "light" });

const openGarden = async (
  page: Page,
  season: "summer" | "autumn" | "winter",
  time: "day" | "night",
): Promise<void> => {
  await seenBefore(page);
  await presetSettings(page, { motion: "on", season, time });
  await page.goto("/");
  await expect(htmlElement(page)).toHaveClass(/garden-ready/);
  // 和紙の文が出る 700ms の遷移を終えてから撮る。遷移の途中だと、舞う物が無くても絵が変わる
  await expect(currentCards(page)).toHaveCSS("opacity", "1");
};

/** 舞う物が動けば変わる差。SwiftShader は同じ場面から同じ画素を描くので、止まっていれば 0 になる */
const diffAfterFrames = async (page: Page): Promise<number> => {
  const stage = page.getByTestId("garden-stage");
  const before = await stage.screenshot();
  await waitForPresentedFrames(page, 10);
  return meanDiff(page, before, await stage.screenshot());
};

/** 表示の設定のアニメーションのスイッチを押し、設定の面を閉じる */
const toggleMotion = async (page: Page): Promise<void> => {
  await page.getByTestId("site-settings-open").click();
  await page.getByTestId("setting-motion").click();
  await page.keyboard.press("Escape");
  await waitForPresentedFrames(page, 3);
};

test.describe("トップの庭の舞う物", () => {
  test("季節を冬、時間帯を夜にして開いた場合、雪が舞い続けること", async ({ page }) => {
    await openGarden(page, "winter", "night");
    expect(await diffAfterFrames(page)).toBeGreaterThan(0);
  });

  test("季節を秋、時間帯を昼にして開いた場合、紅葉が舞い続けること", async ({ page }) => {
    await openGarden(page, "autumn", "day");
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

  test("雪が舞う庭で、表示の設定のアニメーションをオフにした場合、庭を出したまま舞う物が止まること", async ({
    page,
  }) => {
    await openGarden(page, "winter", "night");
    await toggleMotion(page);
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    expect(await diffAfterFrames(page)).toBe(0);
  });

  test("アニメーションをオフにして止めた雪を、オンに戻した場合、雪がまた舞うこと", async ({
    page,
  }) => {
    await openGarden(page, "winter", "night");
    await toggleMotion(page);
    await toggleMotion(page);
    expect(await diffAfterFrames(page)).toBeGreaterThan(0);
  });
});
