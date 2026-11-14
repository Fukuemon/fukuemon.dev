import { expect, test } from "@playwright/test";

import { htmlElement, inkSvg } from "../../selectors/garden";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";

// SwiftShader は場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
test.use({ viewport: { width: 480, height: 270 }, colorScheme: "light" });

test.describe("ヘッダーの歯車の設定とトップの庭", () => {
  test("イントロを見た後に、イントロをもう一度見るボタンを押した場合、初めての訪問と同じイントロがもう一度流れること", async ({
    page,
  }) => {
    await seenBefore(page);
    await page.goto("/");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await expect(htmlElement(page)).not.toHaveClass(/\bintro\b/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("intro-again").click();
    await expect(htmlElement(page)).toHaveClass(/\bintro\b/);
    await expect(inkSvg(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("アニメーションをオフにして初めて開いた場合、イントロを出さずに庭を出すこと", async ({
    page,
  }) => {
    await presetSettings(page, { motion: "off" });
    await page.goto("/");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await expect(htmlElement(page)).not.toHaveClass(/\bintro\b/);
  });

  test("庭の表示をオフにした場合、トップが庭を出さず、ふつうのページになること", async ({
    page,
  }) => {
    await seenBefore(page);
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await expect(htmlElement(page)).not.toHaveClass(/stage-on/);
    await expect(page.getByTestId("garden-stage")).toBeHidden();
    await expect(page.getByTestId("garden-title")).toBeVisible();
  });

  test("ふつうのページのトップで庭の表示をオンにした場合、読み込み直して庭を出すこと", async ({
    page,
  }) => {
    await seenBefore(page);
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-garden").click();
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
  });
});
