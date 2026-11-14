import type { Page } from "@playwright/test";

/**
 * 画面に実際に出たフレームを `count` 枚待つ。
 *
 * `page.clock` を使うと、ページの requestAnimationFrame は 16ms のタイマーに替わり、画面にフレームが出るのを待たない。
 * Playwright の `polling: "raf"` は本物の requestAnimationFrame を使うので、庭の最初の絵が出るまでを待てる。
 * 待たずに撮ると、`toHaveScreenshot` の「安定するまで待つ」が、最初の絵が出るまでの数秒を 5 秒の上限の中で待つことになる。
 */
export const waitForPresentedFrames = async (page: Page, count = 1) => {
  await page.evaluate(() => {
    (window as unknown as { __presentedFrames: number }).__presentedFrames = 0;
  });
  await page.waitForFunction(
    (n) => ++(window as unknown as { __presentedFrames: number }).__presentedFrames > n,
    count,
    { polling: "raf" },
  );
};
