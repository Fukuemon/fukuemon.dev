import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test.describe("トップの庭", () => {
  test.describe("WebGL が使えない場合", () => {
    test("トップを開いた場合、庭を出さずにふつうのページを出すこと", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("garden-stage")).toBeHidden();
    });
  });
});
