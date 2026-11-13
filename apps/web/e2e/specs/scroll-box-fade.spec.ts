import { expect, test, type Locator } from "@playwright/test";

// ぼかしは CSS の scroll-driven animation だけで出し分けるので、ブラウザで描かないと確かめられない
// 検証用の原稿（page-check）に依存する。原稿を消すときは、この spec の記事も差し替える
const fadeOpacity = (box: Locator) =>
  box.evaluate((el) => Number(getComputedStyle(el, "::after").opacity));

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/articles/page-check/body-and-figure/");
});

test("本文の列に収まる表には、右端のぼかしを出さない", async ({ page }) => {
  const box = page.getByRole("region", { name: "表" }).first();
  await expect.poll(() => fadeOpacity(box)).toBe(0);
});

for (const [name, label, index] of [
  ["列の多い表", "表", 1],
  ["横に長い図", "図", 0],
] as const) {
  test(`${name}は、続きがある間だけ右端のぼかしを出す`, async ({ page }) => {
    const box = page.getByRole("region", { name: label }).nth(index);
    await box.scrollIntoViewIfNeeded();
    await expect.poll(() => fadeOpacity(box)).toBe(1);

    await box.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect.poll(() => fadeOpacity(box)).toBe(0);
  });
}
