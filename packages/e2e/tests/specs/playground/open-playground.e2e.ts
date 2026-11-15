import { expect, test } from "@playwright/test";

import { PLAYGROUND_TOOLS } from "../../fixtures/playground";
import { playgroundNavLink } from "../../selectors/site-header";
import { stubPlayground } from "../../fixtures/stub-playground";

test.describe("プレイグラウンドの一覧", () => {
  test("ヘッダーの「プレイグラウンド」を押した場合、/playground が開き、Node、SQL、Go の 3 つが順に並ぶこと", async ({
    page,
  }) => {
    // トップはヘッダーを庭の描画の後に出すので、庭に依らない記事の一覧から押す
    await page.goto("/articles");
    await playgroundNavLink(page).click();
    await expect(page).toHaveURL(/\/playground\/?$/);
    await expect(page.getByTestId("playground-tool-link")).toHaveText(
      PLAYGROUND_TOOLS.map((tool) => tool.name),
    );
  });

  for (const [index, tool] of PLAYGROUND_TOOLS.entries()) {
    test(`${tool.name} のリンクを押した場合、project を付けない URL で、同じタブで開くこと`, async ({
      page,
    }) => {
      await stubPlayground(page);
      await page.goto("/playground");
      const link = page.getByTestId("playground-tool-link").nth(index);
      await expect(link).not.toHaveAttribute("target");
      await link.click();
      await expect(page).toHaveURL(tool.url);
    });
  }

  test("幅 375px で開いた場合、3 つのリンクが画面の幅に収まり、44px 四方以上を押せること", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/playground");
    const links = page.getByTestId("playground-tool-link");
    await expect(links).toHaveCount(PLAYGROUND_TOOLS.length);
    const fits = await links.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          large: box.width >= 44 && box.height >= 44,
          inside: box.left >= 0 && box.right <= window.innerWidth,
        };
      }),
    );
    expect(fits).toStrictEqual(PLAYGROUND_TOOLS.map(() => ({ large: true, inside: true })));
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(width).toStrictEqual({ scroll: 375, inner: 375 });
  });

  test("キーボードだけで操作した場合、Tab で Node、SQL、Go のリンクに順に移れること", async ({
    page,
  }) => {
    await page.goto("/playground");
    const links = page.getByTestId("playground-tool-link");
    // ヘッダーの最後の要素が表示の設定の歯車で、その次が一覧のリンクである前提で、ヘッダーから Tab で続くことを見る
    await page.getByTestId("site-settings-open").focus();
    for (const index of PLAYGROUND_TOOLS.keys()) {
      await page.keyboard.press("Tab");
      await expect(links.nth(index)).toBeFocused();
    }
  });
});
