import { expect, test, type Locator, type Page } from "@playwright/test";
import { meanDiff } from "../support/mean-diff";

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

test.describe("画面の幅の変更", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

  // 和紙の大きさを測り直さないと、カメラが前の幅の和紙の大きさで距離を決め、和紙が画面の幅より小さく見える
  test("幅 1440px で開いた庭を幅 390px にすると、和紙が画面の幅に収まり、幅の 8 割以上になる", async ({
    page,
  }) => {
    await openGarden(page);
    await expectAt(page, "profile");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAt(page, "profile");
    const paper = (await card(page, "profile").boundingBox())!;
    expect({
      inside: paper.x >= 0 && paper.x + paper.width <= 390,
      wide: paper.width >= 390 * 0.8,
    }).toStrictEqual({ inside: true, wide: true });
  });

  // 和紙と枝を掛け直さないと、広げた後も軸木と枝が狭い幅の文の大きさのまま残る。
  // 影と画素比が開いたときの縦横で決まるので、どちらも横長の幅で比べ、軸木と枝が出る和紙の上端の帯だけを比べる
  test("幅 700px で開いた庭を幅 1000px に広げると、和紙の上端の軸木と枝が、幅 1000px で開いたときと同じに描かれる", async ({
    page,
    browser,
  }) => {
    await page.setViewportSize({ width: 700, height: 600 });
    await openGarden(page);
    await expectAt(page, "profile");
    await page.setViewportSize({ width: 1000, height: 700 });
    await expectAt(page, "profile");
    const box = (await card(page, "profile").boundingBox())!;
    const clip = {
      x: box.x - 120,
      y: Math.max(0, box.y - 90),
      width: box.width + 240,
      height: 140,
    };
    const widened = await page.screenshot({ clip });
    const fresh = await browser.newPage({
      viewport: { width: 1000, height: 700 },
      colorScheme: "light",
    });
    try {
      await openGarden(fresh);
      await expectAt(fresh, "profile");
      expect(await meanDiff(page, widened, await fresh.screenshot({ clip }))).toBeLessThan(3);
    } finally {
      await fresh.close();
    }
  });
});

test.describe("幅 320px", () => {
  test.use({ viewport: { width: 320, height: 640 }, colorScheme: "light" });

  test("庭を開くと、4 つの文へ移るボタンが 44px 四方以上の大きさで 1 段に並び、ヘッダーが 1 段に収まる", async ({
    page,
  }) => {
    await openGarden(page);
    // 隣のボタンに覆われずに押せるかを、左右の端から 1px 内側で確かめる。当たり判定は座標を整数に丸めるので、端の 0.5px では隣に当たる
    const boxes = await page.locator("[data-station]").evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        const y = b.top + b.height / 2;
        const own = (x: number) => document.elementFromPoint(x, y) === el;
        return {
          top: b.top,
          width: b.width,
          height: b.height,
          left: b.left,
          right: b.right,
          edges: own(b.left + 1) && own(b.right - 1),
        };
      }),
    );
    const header = (await page.locator("[data-site-header]").boundingBox())!.height;
    expect({
      rows: new Set(boxes.map((b) => Math.round(b.top))).size,
      small: boxes.filter((b) => b.width < 44 || b.height < 44 || !b.edges).length,
      inside: boxes.every((b) => b.left >= 0 && b.right <= 320),
      headerOneRow: header < 80,
    }).toStrictEqual({ rows: 1, small: 0, inside: true, headerOneRow: true });
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

  test("幅 1440px から 390px に変えたときに和紙を掛け直す途中で例外が出ると、ふつうのページに戻り、セクションにインラインのスタイルが残らない", async ({
    page,
  }) => {
    await openGarden(page);
    await page.evaluate(() => {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get() {
          throw new Error("測る途中の失敗");
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    await expect(page.locator("main [data-garden-card]")).toHaveCount(4);
    await expect(page.locator("[data-garden-card][style]")).toHaveCount(0);
  });
});
