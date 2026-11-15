import { expect, test } from "@playwright/test";

import { waitForGardenCanvasWidth } from "../../widgets/waits/canvas-width";
import { waitForPresentedFrames } from "../../widgets/waits/presented-frames";

import { AUTUMN_NOON } from "../../fixtures/garden-time";
import { seenBefore } from "../../widgets/actions/seen-before";

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

// SwiftShader は、ほかの spec と並べると最初の絵が出るまでに数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());

test.describe("トップの庭", () => {
  test.describe("見た目", () => {
    test("秋の昼のトップを開いた場合、止めた庭の絵が基準の画像と同じであること", async ({
      page,
    }) => {
      await seenBefore(page);
      await page.clock.setFixedTime(AUTUMN_NOON);
      await page.goto("/");
      await waitForGardenCanvasWidth(page, 1440);
      await waitForPresentedFrames(page);
      await expect(page.getByTestId("garden-stage")).toHaveScreenshot("garden-autumn-day.png", {
        maxDiffPixelRatio: 0.01,
      });
    });
  });
});
