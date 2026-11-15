import { expect, test, type Page } from "@playwright/test";

import { htmlElement } from "../../selectors/garden";
import { backgroundHaze, bodyElement, inkBackground } from "../../selectors/ink-background";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";

const background = inkBackground;
const siteHeader = (page: Page) => page.getByTestId("site-header");

/** 背景の色が無いときの値 */
const TRANSPARENT = "rgba(0, 0, 0, 0)";

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

/** 背景の墨の絵の SVG の応答を集める。値は応答の状態コード */
const inkResponses = (page: Page) => {
  const statuses: number[] = [];
  page.on("response", (r) => {
    if (/\/ink-background\.[^/]*\.svg$/.test(new URL(r.url()).pathname)) statuses.push(r.status());
  });
  return statuses;
};

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("薄墨の背景の絵", () => {
  test.describe("見た目", () => {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`3D 表示（WebGL）とアニメーションをオフにして ${colorScheme} で開いた場合、止まった背景の絵が基準の画像と同じであること`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await presetSettings(page, { garden: "off", motion: "off" });
        await page.goto("/");
        await expect(background(page)).toBeVisible();
        // 本文の字はシステムフォントで描くので、背景の絵だけを比べる
        await page.addStyleTag({
          content:
            "body { visibility: hidden; } [data-testid='ink-background'] { visibility: visible; }",
        });
        // 線は濃さ 16% で紙の色との差が小さいので、既定の threshold では絵が消えても差に数えない
        await expect(background(page)).toHaveScreenshot(`garden-background-${colorScheme}.png`, {
          maxDiffPixelRatio: 0.01,
          threshold: 0.02,
        });
      });
    }
  });

  test("庭を出さない場合、ページの背景の色を html に移し、body を透明にすること", async ({
    page,
  }) => {
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await expect(bodyElement(page)).toHaveCSS("background-color", TRANSPARENT);
  });

  test("庭を出さない場合、ヘッダーに紙の色を敷いて絵を隠すこと", async ({ page }) => {
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await expect(siteHeader(page)).not.toHaveCSS("background-color", TRANSPARENT);
  });

  test("背景の絵を読み上げから外していること", async ({ page }) => {
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await expect(background(page)).toHaveAttribute("aria-hidden", "true");
  });

  test("庭を出さない訪問では、墨の絵の SVG を 1 回取得すること", async ({ page }) => {
    const responses = inkResponses(page);
    await presetSettings(page, { garden: "off" });
    await page.goto("/");
    await page.waitForLoadState("load");
    expect(responses).toStrictEqual([200]);
  });

  test("庭を出す訪問では、背景を出さず、墨の絵の SVG を取得しないこと", async ({ page }) => {
    // SwiftShader で庭が出るまで待つので、ほかの庭の spec と同じく時間の上限を 3 倍にする
    test.slow();
    const responses = inkResponses(page);
    await seenBefore(page);
    await page.goto("/");
    await expect(page.getByTestId("garden-stage")).toBeVisible();
    await page.waitForLoadState("load");
    await expect(background(page)).toBeHidden();
    expect(responses).toStrictEqual([]);
  });

  test.describe("ハイコントラストの場合", () => {
    test.use({ forcedColors: "active" });

    test("背景を出さないこと", async ({ page }) => {
      await presetSettings(page, { garden: "off" });
      await page.goto("/");
      await expect(background(page)).toBeHidden();
    });
  });

  test.describe("動き", () => {
    test("3D 表示（WebGL）をオフにしてアニメーションをオンにした場合、霞が流れること", async ({
      page,
    }) => {
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
        await expect(backgroundHaze(page).first()).toHaveCSS("animation-name", "none");
      });
    });
  });

  for (const { name, path } of [
    { name: "記事の一覧", path: "/articles/" },
    { name: "プレイグラウンドの一覧", path: "/playground/" },
  ]) {
    test.describe(name, () => {
      test("背景を出すこと", async ({ page }) => {
        await page.goto(path);
        await expect(background(page)).toBeVisible();
      });

      test("墨の絵の SVG を 1 回取得すること", async ({ page }) => {
        const responses = inkResponses(page);
        await page.goto(path);
        await page.waitForLoadState("load");
        expect(responses).toStrictEqual([200]);
      });

      test("ヘッダーに紙の色を敷いて絵を隠すこと", async ({ page }) => {
        await page.goto(path);
        await expect(siteHeader(page)).not.toHaveCSS("background-color", TRANSPARENT);
      });

      test("アニメーションをオンにした場合、霞が流れること", async ({ page }) => {
        await presetSettings(page, { motion: "on" });
        await page.goto(path);
        await expect.poll(() => runningHaze(page)).toBeGreaterThan(0);
      });

      test("アニメーションをオフにした場合、霞が止まること", async ({ page }) => {
        await presetSettings(page, { motion: "off" });
        await page.goto(path);
        await expect(background(page)).toBeVisible();
        expect(await runningHaze(page)).toBe(0);
      });
    });
  }

  test.describe("背景を出さないページ（記事の本文）", () => {
    const article = "/articles/page-check/body-and-figure/";

    test("背景の要素を置かないこと", async ({ page }) => {
      await page.goto(article);
      await expect(background(page)).toHaveCount(0);
    });

    test("墨の絵の SVG を取得しないこと", async ({ page }) => {
      const responses = inkResponses(page);
      await page.goto(article);
      await page.waitForLoadState("load");
      expect(responses).toStrictEqual([]);
    });

    test("html に背景を出すページの印を付けないこと", async ({ page }) => {
      await page.goto(article);
      await expect(htmlElement(page)).not.toHaveAttribute("data-ink-background");
    });
  });
});
