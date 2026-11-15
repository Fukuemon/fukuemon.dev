import { expect, test } from "@playwright/test";

import { waitForGardenCanvasWidth } from "../../widgets/waits/canvas-width";
import { waitForPresentedFrames } from "../../widgets/waits/presented-frames";

import { presetSettings } from "../../widgets/actions/preset-settings";
import { seenBefore } from "../../widgets/actions/seen-before";

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

// SwiftShader は、ほかの spec と並べると最初の絵が出るまでに数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
const TIMES = ["morning", "day", "evening", "night"] as const;

test.describe("トップの庭", () => {
  test.describe("見た目", () => {
    for (const season of SEASONS) {
      for (const time of TIMES) {
        test(`季節を ${season}、時間帯を ${time} にしてアニメーションを止めた場合、庭の絵が基準の画像と同じであること`, async ({
          page,
        }) => {
          await seenBefore(page);
          // 舞う物は止めると動き始めの位置で止まるので、毎回同じ絵になる
          await presetSettings(page, { motion: "off", season, time });
          await page.goto("/");
          await waitForGardenCanvasWidth(page, 1440);
          await waitForPresentedFrames(page);
          await expect(page.getByTestId("garden-stage")).toHaveScreenshot(
            `garden-${season}-${time}.png`,
            { maxDiffPixelRatio: 0.01 },
          );
        });
      }
    }
  });
});
