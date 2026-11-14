import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test("WebGL が使えないときにトップを開くと、庭を出さずにふつうのページを出す", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-garden-stage]")).toBeHidden();
});
