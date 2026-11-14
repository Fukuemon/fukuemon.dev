import { expect, test } from "@playwright/test";

import { PLAYGROUND_TOOLS } from "../../fixtures/playground";
import { playgroundNavLink } from "../../selectors/site-header";
import { stubPlayground } from "../../fixtures/stub-playground";
import { seenBefore } from "../../widgets/actions/seen-before";

test.describe("プレイグラウンドの一覧", () => {
  test("ヘッダーの「プレイグラウンド」を押した場合、/playground が開き、Node、SQL、Go の 3 つが順に並ぶこと", async ({
    page,
  }) => {
    await seenBefore(page);
    await page.goto("/");
    await playgroundNavLink(page).click();
    await expect(page).toHaveURL(/\/playground\/?$/);
    await expect(playgroundNavLink(page)).toHaveAttribute("aria-current", "page");
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
    const boxes = await links.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height, left: box.left, right: box.right };
      }),
    );
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(375);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("キーボードだけで操作した場合、Tab で Node、SQL、Go のリンクに順に移れること", async ({
    page,
  }) => {
    await page.goto("/playground");
    const links = page.getByTestId("playground-tool-link");
    await playgroundNavLink(page).focus();
    for (const index of PLAYGROUND_TOOLS.keys()) {
      await page.keyboard.press("Tab");
      await expect(links.nth(index)).toBeFocused();
    }
  });
});
