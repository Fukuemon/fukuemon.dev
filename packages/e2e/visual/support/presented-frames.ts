import type { Page } from "@playwright/test";

/**
 * 本物の requestAnimationFrame を `count` 回待つ。最初の 1 回は、最初の絵が画面に出る前に返ることがあるので、既定は 2 回にする。
 *
 * `page.clock` を使うと、ページの requestAnimationFrame は 16ms のタイマーに替わり、画面にフレームが出るのを待たない。
 * Playwright の `polling: "raf"` は本物の requestAnimationFrame を使うので、庭の最初の絵が出るまでを待てる。
 * 待たずに撮ると、`toHaveScreenshot` の「安定するまで待つ」が、最初の絵が出るまでの数秒を 5 秒の上限の中で待つことになる。
 */
export const waitForPresentedFrames = async (page: Page, count = 2) => {
  await page.evaluate(() => {
    (window as unknown as { __presentedFrames: number }).__presentedFrames = 0;
  });
  await page.waitForFunction(
    (n) => ++(window as unknown as { __presentedFrames: number }).__presentedFrames > n,
    count,
    { polling: "raf" },
  );
};
