import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test("WebGL が使えないときにトップを開くと、庭を出さずに、ふつうのページの見出しが出る", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/stage-on/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
