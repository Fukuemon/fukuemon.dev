import { expect, test } from "@playwright/test";

// 撮影の仕組みが動くことを、カタログの story を 1 つ開いて確かめる
test("カタログの ArtBand の story を開くと、帯の挿絵が出る", async ({ page }) => {
  await page.goto("iframe.html?id=コンポーネント-base-artband--seigaiha&viewMode=story");
  await expect(page.getByRole("heading", { name: "記事" })).toBeVisible();
  await expect(page.locator('[data-motif="seigaiha"] svg')).toBeVisible();
});
