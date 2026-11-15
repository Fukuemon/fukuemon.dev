import { expect, test, type Page } from "@playwright/test";

import { meanDiff } from "../../widgets/actions/mean-diff";
import { settledCenterX } from "../../widgets/waits/settled-center-x";
import {
  careerSummaries,
  currentCards,
  draggableCards,
  htmlElement,
  mainCards,
  navButtons,
  notCurrentCards,
  openedCareerDetails,
  stations,
  styledCards,
} from "../../selectors/garden";

import { AUTUMN_NOON } from "../../fixtures/garden-time";
import { seenBefore } from "../../widgets/actions/seen-before";
import { presetSettings } from "../../widgets/actions/preset-settings";

// SwiftShader は 1 フレームを描くのが遅く、カメラが止まるまで数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());

/**
 * 庭を開く。`paused` が true のときは、表示の設定でアニメーションをオフにして開く。
 * カメラは、オフにすると 1 フレームで行き先に着く。止めないと、SwiftShader の描画が遅いので、2 回の移動に単独でも 35〜46 秒かかり、ほかの spec と並べると、`expectAt` の 1 回の待ちの上限（config の expect の時間）を超える。
 * 移動の動き自体を確かめるテスト以外は、止めてから移る。
 * 止めないときは、舞う物の無い夏の昼で開く。舞う物があると、SwiftShader が描き続けてメインスレッドが空かず、クリックが時間の上限を超えるためである。
 */
const openGarden = async (page: Page, { paused = false } = {}) => {
  await seenBefore(page);
  await presetSettings(
    page,
    paused ? { motion: "off", garden: "on" } : { season: "summer", time: "day" },
  );
  await page.clock.setFixedTime(AUTUMN_NOON);
  await page.goto("/");
  await expect(htmlElement(page)).toHaveClass(/garden-ready/);
};

const card = (page: Page, id: string) => page.getByTestId(`garden-card-${id}`);

/** 庭の中のボタンのうち、いちばん上のボタンの上端の y */
const navTop = async (page: Page) =>
  Math.min(
    ...(await navButtons(page).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().top),
    )),
  );

/** カメラがその文の正面に来て、その文だけが見えている */
const expectAt = async (page: Page, id: string) => {
  await expect(notCurrentCards(page)).toHaveCount(3);
  await expect
    .poll(async () => {
      const x = await settledCenterX(card(page, id));
      return x !== null && x > 0.4 && x < 0.6;
    })
    .toBe(true);
  await expect(card(page, id)).toHaveCSS("opacity", "1");
};

test.describe("トップの庭", () => {
  test.describe("幅 1440px", () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

    test("2 つ目の文へ移るボタンを押した場合、カメラが動き、経歴の文だけが見え、見出しを読み上げに通知すること", async ({
      page,
    }) => {
      await openGarden(page);
      await page.getByTestId("garden-station-1").click();
      await expectAt(page, "career");
      await expect(page.getByTestId("garden-station-1")).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("garden-live")).toHaveText("経歴");
    });

    test("右の矢印キーを押した場合、次の文へ移ること", async ({ page }) => {
      await openGarden(page, { paused: true });
      await page.keyboard.press("ArrowRight");
      await expectAt(page, "career");
      await page.keyboard.press("ArrowRight");
      await expectAt(page, "stack");
    });

    test("最初の文で左の矢印キーを押した場合、4 つ目の文へ回ること", async ({ page }) => {
      await openGarden(page, { paused: true });
      await page.keyboard.press("ArrowLeft");
      await expectAt(page, "portfolio");
    });

    test("プロフィールの見出しにフォーカスがある状態で右の矢印キーを押した場合、フォーカスが 2 つ目の文へ移るボタンに移ること", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
      await page.getByTestId("garden-title").focus();
      await page.keyboard.press("ArrowRight");
      await expectAt(page, "career");
      await expect(page.getByTestId("garden-station-1")).toBeFocused();
    });

    test("表示の設定で庭の表示をオフにした場合、ふつうのページが出て、フォーカスが設定に残り、セクションにインラインのスタイルが残らないこと", async ({
      page,
    }) => {
      await openGarden(page);
      await page.getByTestId("garden-station-1").click();
      await page.getByTestId("site-settings-open").click();
      await page.getByTestId("setting-garden").click();
      await expect(page.getByTestId("garden-stage")).toBeHidden();
      await expect(page.getByTestId("garden-nav")).toBeHidden();
      await expect(page.getByTestId("setting-garden")).toBeFocused();
      await expect(page.getByTestId("setting-garden")).toHaveAttribute("aria-checked", "false");
      await expect(mainCards(page)).toHaveCount(4);
      await expect(styledCards(page)).toHaveCount(0);
      await expect(currentCards(page)).toHaveCount(0);
      await expect(draggableCards(page)).toHaveCount(0);
      await expect(htmlElement(page)).not.toHaveAttribute("style", /--scene-/);
    });
  });

  test.describe("幅 390px", () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });

    test("4 つの文のどれへ移った場合も、和紙が画面の幅に収まり、ボタンが文に重ならないこと", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
      for (const [i, id] of ["profile", "career", "stack", "portfolio"].entries()) {
        await page.getByTestId(`garden-station-${i}`).click();
        await expectAt(page, id);
        const paper = (await card(page, id).boundingBox())!;
        expect(paper.x).toBeGreaterThanOrEqual(0);
        expect(paper.x + paper.width).toBeLessThanOrEqual(390);
        expect(paper.y + paper.height).toBeLessThanOrEqual(await navTop(page));
      }
    });

    // 和紙が伸びると、カメラが和紙を画面に収めようと引き、字と押せる範囲が小さく映る
    test("経歴の行の詳細を 1 つずつ開いた場合、開いた詳細は 1 つだけで、その行が 44px 以上の高さと 14px 以上の字で映り、和紙が画面の幅とボタンの上に収まること", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
      await page.getByTestId("garden-station-1").click();
      await expectAt(page, "career");
      await expect(careerSummaries(page)).toHaveCount(4);
      const rows = [];
      for (let i = 0; i < 4; i++) {
        const summary = careerSummaries(page).nth(i);
        await summary.click();
        await expectAt(page, "career");
        const paper = (await card(page, "career").boundingBox())!;
        const shown = (await summary.boundingBox())!.height;
        const laid = await summary.evaluate((el) => (el as HTMLElement).offsetHeight);
        const top = await navTop(page);
        rows.push({
          opened: await openedCareerDetails(page).count(),
          tall: shown >= 44,
          text: (16 * shown) / laid >= 14,
          inside: paper.x >= 0 && paper.x + paper.width <= 390,
          aboveNav: paper.y + paper.height <= top,
        });
        await summary.click();
      }
      expect(rows).toStrictEqual(
        Array.from({ length: 4 }, () => ({
          opened: 1,
          tall: true,
          text: true,
          inside: true,
          aboveNav: true,
        })),
      );
    });
  });

  test.describe("経歴の詳細の開閉", () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

    // 幅 1440px の経歴の和紙は、画面の高さで距離が決まる。掛け直さないと、詳細を開いて低くなった文が、閉じたときの距離のまま小さく映る
    test("経歴の 1 行目の詳細を開いた場合、和紙を掛け直し、閉じたときと同じ高さで映ること", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
      await page.getByTestId("garden-station-1").click();
      await expectAt(page, "career");
      const closed = (await card(page, "career").boundingBox())!.height;
      await careerSummaries(page).first().click();
      await expect
        .poll(async () => Math.abs((await card(page, "career").boundingBox())!.height - closed) < 3)
        .toBe(true);
    });
  });

  test.describe("画面の幅の変更", () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

    // 和紙の大きさを測り直さないと、カメラが前の幅の和紙の大きさで距離を決め、和紙が画面の幅より小さく見える
    test("幅 1440px で開いた庭を幅 390px にした場合、和紙が画面の幅に収まり、幅の 8 割以上になること", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
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
    test("幅 700px で開いた庭を幅 1000px に広げた場合、和紙の上端の軸木と枝が、幅 1000px で開いたときと同じに描かれること", async ({
      page,
      browser,
    }) => {
      await page.setViewportSize({ width: 700, height: 600 });
      await openGarden(page, { paused: true });
      await expectAt(page, "profile");
      await page.setViewportSize({ width: 1000, height: 700 });
      await expectAt(page, "profile");
      const box = (await card(page, "profile").boundingBox())!;
      const clip = {
        x: Math.max(0, box.x - 120),
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
        await openGarden(fresh, { paused: true });
        await expectAt(fresh, "profile");
        expect(await meanDiff(page, widened, await fresh.screenshot({ clip }))).toBeLessThan(3);
      } finally {
        await fresh.close();
      }
    });
  });

  test.describe("幅 320px", () => {
    test.use({ viewport: { width: 320, height: 640 }, colorScheme: "light" });

    test("庭を開いた場合、4 つの文へ移るボタンが 44px 四方以上の大きさで 2 行以内に並び、ヘッダーが 1 段に収まること", async ({
      page,
    }) => {
      await openGarden(page);
      // 隣のボタンに覆われずに押せるかを、左右の端から 2px 内側で確かめる（枠は隣と 1px 重なる）。当たり判定は座標を整数に丸めるので、端の 0.5px では隣に当たる
      const boxes = await stations(page).evaluateAll((els) =>
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
            edges: own(b.left + 2) && own(b.right - 2),
          };
        }),
      );
      const header = (await page.getByTestId("site-header").boundingBox())!.height;
      expect({
        rows: new Set(boxes.map((b) => Math.round(b.top))).size <= 2,
        small: boxes.filter((b) => b.width < 44 || b.height < 44 || !b.edges).length,
        inside: boxes.every((b) => b.left >= 0 && b.right <= 320),
        headerOneRow: header < 80,
      }).toStrictEqual({ rows: true, small: 0, inside: true, headerOneRow: true });
    });
  });

  test.describe("ダークのテーマ", () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });

    // 和紙の字の色は時間帯の場面の色で、テーマのトークンが和紙の中に入らない
    test("昼の庭を開いた場合、和紙の字が、ライトのテーマと同じ場面の色で出ること", async ({
      page,
    }) => {
      await openGarden(page);
      const color = await page
        .getByTestId("garden-title")
        .evaluate((el) => getComputedStyle(el).color);
      expect(color).toBe("rgb(26, 23, 20)");
    });
  });

  /** ふつうのページに戻ったかを、庭の要素が見えるか、main の中のセクションの数、インラインのスタイルが残るセクションの数で返す */
  const plainPage = async (page: Page) => ({
    stage: await page.getByTestId("garden-stage").isVisible(),
    cards: await mainCards(page).count(),
    styled: await styledCards(page).count(),
  });

  test.describe("描く途中の例外", () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

    test("場面を描く途中で例外が出た場合、ふつうのページに戻り、セクションにインラインのスタイルが残らないこと", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        WebGL2RenderingContext.prototype.drawElements = () => {
          throw new Error("描画の失敗");
        };
      });
      await page.clock.setFixedTime(AUTUMN_NOON);
      await page.goto("/");
      await expect.poll(() => plainPage(page)).toStrictEqual({ stage: false, cards: 4, styled: 0 });
    });

    test("幅 1440px から 390px に変えたときに和紙を掛け直す途中で例外が出た場合、ふつうのページに戻り、セクションにインラインのスタイルが残らないこと", async ({
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
      await expect.poll(() => plainPage(page)).toStrictEqual({ stage: false, cards: 4, styled: 0 });
    });

    test("経歴の詳細を開いたときに和紙を掛け直す途中で例外が出た場合、ふつうのページに戻り、セクションにインラインのスタイルが残らないこと", async ({
      page,
    }) => {
      await openGarden(page, { paused: true });
      await page.getByTestId("garden-station-1").click();
      await expectAt(page, "career");
      await page.evaluate(() => {
        Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
          configurable: true,
          get() {
            throw new Error("測る途中の失敗");
          },
        });
      });
      await careerSummaries(page).first().click();
      await expect.poll(() => plainPage(page)).toStrictEqual({ stage: false, cards: 4, styled: 0 });
    });
  });
});
