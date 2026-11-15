import { expect, test, type Page } from "@playwright/test";

import { htmlElement } from "../../selectors/garden";
import { articlesNavLink } from "../../selectors/site-header";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { AUTUMN_NOON } from "../../fixtures/garden-time";

const openButton = (page: Page) => page.getByTestId("site-settings-open");
const panel = (page: Page) => page.getByTestId("site-settings");
const motion = (page: Page) => page.getByTestId("setting-motion");
const garden = (page: Page) => page.getByTestId("setting-garden");
const introAgain = (page: Page) => page.getByTestId("intro-again");

const brushDuration = (page: Page) =>
  articlesNavLink(page).evaluate((el) => getComputedStyle(el, "::after").transitionDuration);

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });

test.describe("表示の設定", () => {
  test("歯車を押した場合、設定の面が開き、2 つのスイッチが保存した値で出て、イントロをもう一度見るボタンが出ること", async ({
    page,
  }) => {
    await presetSettings(page, { motion: "off", garden: "on" });
    await page.goto("/articles");
    await openButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(motion(page)).toHaveAttribute("aria-checked", "false");
    await expect(garden(page)).toHaveAttribute("aria-checked", "true");
    await expect(introAgain(page)).toBeVisible();
    await expect(introAgain(page)).toHaveAttribute("aria-disabled", "true");
    // aria-disabled のボタンは Playwright が押せない要素として待つので、押せることを確かめずに押す
    await introAgain(page).click({ force: true });
    await expect(page).toHaveURL(/\/articles$/);
  });

  test("保存していない場合、季節と時間帯は自動で出て、選んだ値はトップを開いたときの季節と時間帯になること", async ({
    page,
  }) => {
    // 選んだ値を無視しても、端末の日付と時刻が同じ季節と時間帯なら通ってしまうので、秋の昼に固定し、夏の夕を選ぶ
    await page.clock.setFixedTime(AUTUMN_NOON);
    await page.goto("/articles");
    await openButton(page).click();
    await expect(page.getByTestId("setting-season-auto")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("setting-time-auto")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("setting-season-summer").click();
    await page.getByTestId("setting-time-evening").click();
    await expect(page.getByTestId("setting-season-summer")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("setting-season-auto")).toHaveAttribute("aria-pressed", "false");
    await page.goto("/");
    await expect(htmlElement(page)).toHaveAttribute("data-season", "summer");
    await expect(htmlElement(page)).toHaveAttribute("data-time", "evening");
  });

  test("アニメーションをオフにした場合、ヘッダーの筆の線が動かなくなること", async ({ page }) => {
    await page.goto("/articles");
    await expect.poll(() => brushDuration(page)).toBe("0.24s");
    await openButton(page).click();
    await motion(page).click();
    await expect(htmlElement(page)).toHaveAttribute("data-motion", "off");
    await expect.poll(() => brushDuration(page)).toBe("1e-05s");
  });

  test("設定を変えてから別のページを開いた場合と読み込み直した場合、変えた設定が残ること", async ({
    page,
  }) => {
    await page.goto("/articles");
    await openButton(page).click();
    await motion(page).click();
    await garden(page).click();
    await page.goto("/");
    await expect(htmlElement(page)).toHaveAttribute("data-motion", "off");
    await expect(htmlElement(page)).toHaveAttribute("data-garden", "off");
    await expect(page.getByTestId("garden-stage")).toBeHidden();
    await page.reload();
    await openButton(page).click();
    await expect(motion(page)).toHaveAttribute("aria-checked", "false");
    await expect(garden(page)).toHaveAttribute("aria-checked", "false");
  });

  test.describe("OS で動きを減らす設定", () => {
    test.use({ reducedMotion: "reduce" });

    test("初めて開いた場合、アニメーションの初期値がオフになること", async ({ page }) => {
      await page.goto("/articles");
      await openButton(page).click();
      await expect(motion(page)).toHaveAttribute("aria-checked", "false");
      await expect.poll(() => brushDuration(page)).toBe("1e-05s");
    });

    test("アニメーションをオンにした場合、OS の設定に依らず筆の線が動くこと", async ({ page }) => {
      await page.goto("/articles");
      await openButton(page).click();
      await motion(page).click();
      await expect.poll(() => brushDuration(page)).toBe("0.24s");
    });
  });

  test("キーボードだけで操作した場合、歯車、設定の面、スイッチ、季節と時間帯のボタンに移れ、Esc で面が閉じて歯車にフォーカスが戻ること", async ({
    page,
  }) => {
    await page.goto("/articles");
    await openButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(motion(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(motion(page)).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Tab");
    await expect(garden(page)).toBeFocused();
    for (const id of [
      "setting-season-auto",
      "setting-season-spring",
      "setting-season-summer",
      "setting-season-autumn",
      "setting-season-winter",
      "setting-time-auto",
      "setting-time-morning",
      "setting-time-day",
      "setting-time-evening",
      "setting-time-night",
    ]) {
      await page.keyboard.press("Tab");
      await expect(page.getByTestId(id)).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("setting-time-night")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(introAgain(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(openButton(page)).toBeFocused();
  });
});
