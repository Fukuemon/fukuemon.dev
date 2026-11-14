import { expect, test, type Page } from "@playwright/test";

import { htmlElement } from "../../selectors/garden";
import { articlesNavLink } from "../../selectors/site-header";
import { presetSettings } from "../../widgets/actions/preset-settings";

const openButton = (page: Page) => page.getByTestId("site-settings-open");
const panel = (page: Page) => page.getByTestId("site-settings");
const motion = (page: Page) => page.getByTestId("setting-motion");
const garden = (page: Page) => page.getByTestId("setting-garden");
const introAgain = (page: Page) => page.getByTestId("intro-again");

const brushDuration = (page: Page) =>
  articlesNavLink(page).evaluate((el) => getComputedStyle(el, "::after").transitionDuration);

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });

test.describe("ヘッダーの歯車の設定", () => {
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

  test("キーボードだけで操作した場合、歯車、設定の面、スイッチに移れ、Esc で面が閉じて歯車にフォーカスが戻ること", async ({
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
    await page.keyboard.press("Tab");
    await expect(introAgain(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(openButton(page)).toBeFocused();
  });
});
