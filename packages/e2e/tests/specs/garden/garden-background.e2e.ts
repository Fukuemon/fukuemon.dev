import { expect, test, type Page } from "@playwright/test";

import { htmlElement } from "../../selectors/garden";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";

const background = (page: Page) => page.getByTestId("garden-background");

/** 背景の霞のうち、動いているアニメーションの数 */
const runningHaze = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            a instanceof CSSAnimation &&
            a.animationName.startsWith("ink-haze-drift"),
        ).length,
  );

/** 背景の墨の絵の SVG の取得を数える */
const countInkRequests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("ink-background")) urls.push(r.url());
  });
  return urls;
};

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("トップの背景の墨の絵", () => {
  test.describe("見た目", () => {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`庭とアニメーションをオフにして ${colorScheme} で開いた場合、止まった背景の絵が基準の画像と同じであること`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await presetSettings(page, { garden: "off", motion: "off" });
        await page.goto("/");
        await expect(background(page)).toBeVisible();
        // 本文の字はシステムフォントで描くので、背景の絵だけを比べる
        await page.addStyleTag({
          content:
            "body { visibility: hidden; } [data-testid='garden-background'] { visibility: visible; }",
        });
        await expect(background(page)).toHaveScreenshot(`garden-background-${colorScheme}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });

  test("背景の絵を読み上げから外していること", async ({ page }) => {
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await expect(background(page)).toHaveAttribute("aria-hidden", "true");
  });

  test("庭を出す訪問では、背景を出さず、墨の絵の SVG を取得しないこと", async ({ page }) => {
    const requests = countInkRequests(page);
    await seenBefore(page);
    await page.goto("/");
    await expect(page.getByTestId("garden-stage")).toBeVisible();
    await page.waitForLoadState("load");
    await expect(background(page)).toBeHidden();
    expect(requests).toStrictEqual([]);
  });

  test.describe("動き", () => {
    test("庭をオフにしてアニメーションをオンにした場合、霞が流れること", async ({ page }) => {
      await presetSettings(page, { garden: "off", motion: "on" });
      await page.goto("/");
      await expect(background(page)).toBeVisible();
      await expect.poll(() => runningHaze(page)).toBeGreaterThan(0);
    });

    test("表示の設定でアニメーションをオフにした場合、霞が止まること", async ({ page }) => {
      await presetSettings(page, { garden: "off", motion: "off" });
      await page.goto("/");
      await expect(background(page)).toBeVisible();
      expect(await runningHaze(page)).toBe(0);
    });

    test.describe("OS で動きを減らす設定にしている場合", () => {
      test.use({ reducedMotion: "reduce" });

      test("表示の設定を保存していなければ、止まった背景の絵を出すこと", async ({ page }) => {
        await page.goto("/");
        await expect(background(page)).toBeVisible();
        expect(await runningHaze(page)).toBe(0);
      });
    });

    test.describe("JavaScript が動かない場合", () => {
      test.use({ javaScriptEnabled: false });

      test("止まった背景の絵を出すこと", async ({ page }) => {
        await page.goto("/");
        await expect(background(page)).toBeVisible();
        await expect(htmlElement(page)).not.toHaveAttribute("data-motion", /.*/);
      });
    });
  });
});
