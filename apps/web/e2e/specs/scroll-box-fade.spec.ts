import { expect, test, type Locator, type Page } from "@playwright/test";

// ぼかしは CSS の scroll-driven animation だけで出し分けるので、ブラウザで描かないと確かめられない
// 検証用の原稿（page-check）に依存する。原稿を消すときは、この spec の記事も差し替える
const fadeOpacity = (box: Locator) =>
  box.evaluate((el) => Number(getComputedStyle(el, "::after").opacity));

// scroll timeline の進みはフレームごとに取り込まれるので、送った後に 2 フレーム待ってから読む
const scrollToRatio = async (box: Locator, ratio: number) => {
  await box.evaluate(
    (el, r) =>
      new Promise((done) => {
        el.scrollTo({ left: (el.scrollWidth - el.clientWidth) * r });
        requestAnimationFrame(() => requestAnimationFrame(done));
      }),
    ratio,
  );
};

const smallTable = (page: Page) =>
  page
    .getByRole("region", { name: "表" })
    .filter({ has: page.getByRole("columnheader", { name: "項目" }) });
const wideTable = (page: Page) =>
  page
    .getByRole("region", { name: "表" })
    .filter({ has: page.getByRole("columnheader", { name: "列 6" }) });
const figure = (page: Page) => page.getByRole("region", { name: "図" });
const shortCode = (page: Page) =>
  page.locator(".expressive-code pre").filter({ hasText: "web build" });
const longCode = (page: Page) =>
  page.locator(".expressive-code pre").filter({ hasText: "--devOutput" });

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/articles/page-check/body-and-figure/");
});

test("本文の列に収まる表には、右端のぼかしを出さない", async ({ page }) => {
  await expect.poll(() => fadeOpacity(smallTable(page))).toBe(0);
});

test("本文の列に収まるコードブロックには、右端のぼかしを出さない", async ({ page }) => {
  await expect.poll(() => fadeOpacity(shortCode(page))).toBe(0);
});

for (const [name, box] of [
  ["列の多い表", wideTable],
  ["横に長い図", figure],
  ["横に長いコードブロック", longCode],
] as const) {
  test(`${name}は、送る前に右端のぼかしを出す`, async ({ page }) => {
    await expect.poll(() => fadeOpacity(box(page))).toBe(1);
  });

  test(`${name}は、右端まで送るとぼかしを消す`, async ({ page }) => {
    await scrollToRatio(box(page), 1);
    await expect.poll(() => fadeOpacity(box(page))).toBe(0);
  });
}

test("列の多い表は、右端の手前で、ぼかしを薄くし始める", async ({ page }) => {
  await scrollToRatio(wideTable(page), 0.95);
  const opacity = await fadeOpacity(wideTable(page));
  expect(opacity > 0 && opacity < 1).toBe(true);
});

test.describe("動きを減らす設定", () => {
  test.use({ reducedMotion: "reduce" });

  test("列の多い表は、右端の手前ではぼかしを薄くしない", async ({ page }) => {
    await scrollToRatio(wideTable(page), 0.95);
    await expect.poll(() => fadeOpacity(wideTable(page))).toBe(1);
  });

  test("列の多い表は、右端に着いたときにぼかしを一度に消す", async ({ page }) => {
    await scrollToRatio(wideTable(page), 1);
    await expect.poll(() => fadeOpacity(wideTable(page))).toBe(0);
  });
});
