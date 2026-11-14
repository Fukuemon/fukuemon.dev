import { expect, test, type Locator, type Page } from "@playwright/test";

// 秋の昼。季節と時間帯は、端末の日付と時刻で決まる
const AUTUMN_NOON = new Date(2026, 10, 13, 12);

// SwiftShader は 1 フレームを描くのが遅く、カメラが止まるまで数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());

const openGarden = async (page: Page) => {
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/garden-ready/);
};

const card = (page: Page, id: string) =>
  page.locator(`[data-garden-card][aria-labelledby="${id}"]`);

/**
 * 要素の中心の x が画面の幅のどこにあるか（0〜1）を返す。
 * カメラが動いている間は、10 フレームの間に位置が変わるので null を返す。
 */
const settledCenterX = (el: Locator) =>
  el.evaluate(async (node) => {
    const before = node.getBoundingClientRect();
    for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame);
    const after = node.getBoundingClientRect();
    if (Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 0.5) return null;
    return (after.x + after.width / 2) / innerWidth;
  });

/** カメラがその文の正面に来て、その文だけが見えている */
const expectAt = async (page: Page, id: string) => {
  await expect(page.locator("[data-garden-card]:not(.is-current)")).toHaveCount(3);
  await expect
    .poll(
      async () => {
        const x = await settledCenterX(card(page, id));
        return x !== null && x > 0.4 && x < 0.6;
      },
      { timeout: 45_000 },
    )
    .toBe(true);
  await expect(card(page, id)).toHaveCSS("opacity", "1", { timeout: 45_000 });
};

test.describe("幅 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

  test("2 つ目の文へ移るボタンを押すと、カメラが動き、経歴の文だけが見え、見出しを読み上げに通知する", async ({
    page,
  }) => {
    await openGarden(page);
    await page.getByRole("button", { name: "経歴" }).click();
    await expectAt(page, "career");
    await expect(page.getByRole("button", { name: "経歴" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.locator("[data-garden-live]")).toHaveText("経歴");
  });

  test("右の矢印キーを押すと、次の文へ移る", async ({ page }) => {
    await openGarden(page);
    await page.keyboard.press("ArrowRight");
    await expectAt(page, "career");
    await page.keyboard.press("ArrowRight");
    await expectAt(page, "stack");
  });

  test("最初の文で左の矢印キーを押すと、4 つ目の文へ回る", async ({ page }) => {
    await openGarden(page);
    await page.keyboard.press("ArrowLeft");
    await expectAt(page, "articles");
  });

  test("Tab で 4 つ目の文の中のリンクにフォーカスを移すと、カメラが 4 つ目の文へ動く", async ({
    page,
  }) => {
    await openGarden(page);
    const link = card(page, "articles").getByRole("link");
    for (let i = 0; i < 10 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    await expectAt(page, "articles");
  });

  test("「文だけで読む」を押すと、ふつうのページが出て、フォーカスが h1 に移り、セクションにインラインのスタイルが残らない", async ({
    page,
  }) => {
    await openGarden(page);
    await page.getByRole("button", { name: "経歴" }).click();
    await page.getByRole("button", { name: "文だけで読む" }).click();
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    await expect(page.locator("[data-garden-nav]")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.locator("main [data-garden-card]")).toHaveCount(4);
    await expect(page.locator("[data-garden-card][style]")).toHaveCount(0);
    await expect(page.locator("[data-garden-card].is-current")).toHaveCount(0);
    await expect(page.locator("[data-garden-card][draggable]")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.getAttribute("style") ?? ""),
    ).not.toContain("--scene-");
  });
});

test.describe("幅 390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });

  test("4 つの文のどれへ移っても、和紙が画面の幅に収まり、ボタンが文に重ならない", async ({
    page,
  }) => {
    await openGarden(page);
    for (const [i, id] of ["profile", "career", "stack", "articles"].entries()) {
      await page.locator(`[data-station="${i}"]`).click();
      await expectAt(page, id);
      const paper = (await card(page, id).boundingBox())!;
      expect(paper.x).toBeGreaterThanOrEqual(0);
      expect(paper.x + paper.width).toBeLessThanOrEqual(390);
      const top = Math.min(
        ...(await page
          .locator("[data-garden-nav] button")
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))),
      );
      expect(paper.y + paper.height).toBeLessThanOrEqual(top);
    }
  });
});

test.describe("ダークのテーマ", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });

  // 和紙の字の色は時間帯の場面の色で、テーマのトークンが和紙の中に入らない
  test("昼の庭を開くと、和紙の字とリンクの字が、ライトのテーマと同じ場面の色で出る", async ({
    page,
  }) => {
    await openGarden(page);
    const colors = await page.evaluate(() => {
      const of = (sel: string) => getComputedStyle(document.querySelector(sel)!).color;
      return [of("#profile"), of('[aria-labelledby="articles"] a')];
    });
    expect(colors).toEqual(["rgb(26, 23, 20)", "rgb(61, 75, 43)"]);
  });
});

test.describe("描く途中の例外", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

  test("場面を描く途中で例外が出ると、ふつうのページに戻り、セクションにインラインのスタイルが残らない", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      WebGL2RenderingContext.prototype.drawElements = () => {
        throw new Error("描画の失敗");
      };
    });
    await page.clock.setFixedTime(AUTUMN_NOON);
    await page.goto("/");
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    await expect(page.locator("main [data-garden-card]")).toHaveCount(4);
    await expect(page.locator("[data-garden-card][style]")).toHaveCount(0);
  });
});
