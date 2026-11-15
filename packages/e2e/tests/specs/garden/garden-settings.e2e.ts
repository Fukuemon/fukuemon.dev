import { expect, test } from "@playwright/test";

import { delayResponse } from "../../fixtures/delay-response";
import { htmlElement, inkSvg } from "../../selectors/garden";
import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";
import { AUTUMN_NOON } from "../../fixtures/garden-time";
import { settledCenterX } from "../../widgets/waits/settled-center-x";
import { waitForPresentedFrames } from "../../widgets/waits/presented-frames";

// SwiftShader は場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
test.use({ viewport: { width: 480, height: 270 }, colorScheme: "light" });

/** 場面のバンドル */
const BUNDLE = "**/_astro/garden-entry-*.js";

test.describe("表示の設定とトップの庭", () => {
  test("イントロを見た後に、イントロをもう一度見るボタンを押した場合、初めての訪問と同じイントロがもう一度流れること", async ({
    page,
  }) => {
    await seenBefore(page);
    // 舞う物があると SwiftShader が描き続けて操作が遅れるので、舞う物の無い夏の昼で開く
    await presetSettings(page, { season: "summer", time: "day" });
    await page.goto("/");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await expect(htmlElement(page)).not.toHaveClass(/\bintro\b/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("intro-again").click();
    await expect(htmlElement(page)).toHaveClass(/\bintro\b/);
    await expect(inkSvg(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("開いている庭でアニメーションをオフにした場合、カメラが動く途中を見せずに次の文へ切り替わること", async ({
    page,
  }) => {
    await seenBefore(page);
    // 舞う物があると SwiftShader が描き続けて操作が遅れるので、舞う物の無い夏の昼で開く
    await presetSettings(page, { season: "summer", time: "day" });
    await page.goto("/");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-motion").click();
    await page.keyboard.press("Escape");
    await page.getByTestId("garden-station-1").click();
    // 止めたカメラは、押した後の 1 フレームで行き先に着く。和紙の位置が書き変わるまでの数フレームを待ってから測る。動かしたままなら数秒かけて寄るので、その後の 10 フレームの間に和紙の位置が変わり null になる
    await waitForPresentedFrames(page, 6);
    const x = await settledCenterX(page.getByTestId("garden-card-career"));
    expect(x !== null && x > 0.4 && x < 0.6).toBe(true);
  });

  test("場面のバンドルを読み込む間に庭の表示をオフにした場合、庭を立ち上げずにふつうのページになること", async ({
    page,
  }) => {
    await seenBefore(page);
    await delayResponse(page, BUNDLE, 3000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(htmlElement(page)).toHaveClass(/stage-on/);
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>('[data-setting="garden"]')?.click(),
    );
    await page.waitForLoadState("load");
    await expect(htmlElement(page)).not.toHaveClass(/stage-on|scene-ready/);
    await expect(page.getByTestId("garden-stage")).toBeHidden();
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

  test("設定の面で季節を冬、時間帯を夜に選んだ場合、トップの庭が冬の夜の場面になり、読み込み直しても残り、自動に戻すと端末の日付と時刻の場面に戻ること", async ({
    page,
  }) => {
    await seenBefore(page);
    // 舞う物が動くと SwiftShader が描き続けて操作が遅れるので、アニメーションを止めて開く
    await presetSettings(page, { motion: "off" });
    await page.clock.setFixedTime(AUTUMN_NOON);
    await page.goto("/");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-season-winter").click();
    await expect(htmlElement(page)).toHaveAttribute("data-season", "winter");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-time-night").click();
    await expect(htmlElement(page)).toHaveAttribute("data-time", "night");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.reload();
    await expect(htmlElement(page)).toHaveAttribute("data-season", "winter");
    await expect(htmlElement(page)).toHaveAttribute("data-time", "night");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.getByTestId("site-settings-open").click();
    await expect(page.getByTestId("setting-season-winter")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("setting-season-auto").click();
    await expect(htmlElement(page)).toHaveAttribute("data-season", "autumn");
    await expect(htmlElement(page)).toHaveClass(/garden-ready/);
    await page.getByTestId("site-settings-open").click();
    await page.getByTestId("setting-time-auto").click();
    await expect(htmlElement(page)).toHaveAttribute("data-time", "day");
  });
});
