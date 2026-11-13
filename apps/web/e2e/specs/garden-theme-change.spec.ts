import { expect, test, type Browser, type Page } from "@playwright/test";

// 秋の昼。季節と時間帯は、端末の日付と時刻で決まる
const AUTUMN_NOON = new Date(2026, 10, 13, 12);
const VIEWPORT = { width: 1440, height: 900 };

const openGarden = async (browser: Browser, colorScheme: "light" | "dark") => {
  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme });
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  await page.waitForFunction(
    (w) => document.querySelector<HTMLCanvasElement>("[data-garden-stage] canvas")?.width === w,
    VIEWPORT.width,
  );
  return page;
};

const shoot = (page: Page) => page.locator("[data-garden-stage]").screenshot();

/** 2 枚の PNG の画素の差の平均（0〜255）を、ブラウザの 2D canvas で求める */
const meanDiff = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(
    async (pngs) => {
      const [pa, pb] = await Promise.all(
        pngs.map(async (b64) => {
          const img = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${b64}`)).blob(),
          );
          const ctx = new OffscreenCanvas(img.width, img.height).getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, img.width, img.height).data;
        }),
      );
      return pa!.reduce((sum, v, i) => sum + Math.abs(v - pb![i]!), 0) / pa!.length;
    },
    [a.toString("base64"), b.toString("base64")],
  );

test("ライトで開いた後に OS のテーマをダークにすると、庭がダークで開いたときと同じ色で描き直される", async ({
  browser,
}) => {
  const page = await openGarden(browser, "light");
  const light = await shoot(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const switched = await shoot(page);

  const darkPage = await openGarden(browser, "dark");
  const dark = await shoot(darkPage);

  expect(await meanDiff(page, light, switched)).toBeGreaterThan(20);
  expect(await meanDiff(page, dark, switched)).toBeLessThan(1);
});
