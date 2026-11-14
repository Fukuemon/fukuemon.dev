import type { Page } from "@playwright/test";

/**
 * url に合う通信の応答を ms 遅らせる。
 * 遅れそのものがテストの条件（HTML や場面のバンドルが遅く届く）なので、何かを待つ代わりの固定の待ちではない。
 */
export const delayResponse = (page: Page, url: string, ms: number) =>
  page.route(url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
