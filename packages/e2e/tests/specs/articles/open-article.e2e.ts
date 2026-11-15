import { expect, test } from "@playwright/test";

import { check, intro, step } from "../../fixtures/caption";
import { mainLandmark, pageHeadings } from "../../selectors/garden";

test.describe("記事の一覧", () => {
  test("1 本目の記事の題を押した場合、その記事のページが開き、見出しが出ること", async ({
    page,
  }) => {
    await page.goto("/articles");
    await intro(page, "記事の一覧から、1 本目の記事を開く");

    const firstLink = page.getByTestId("article-link").first();
    await step(page, "前提 記事の一覧に、記事のページへのリンクがある", async () => {
      await expect(firstLink).toHaveAttribute("href", /^\/articles\/.+/);
    });
    await step(page, "もし 1 本目の記事の題を押す", async () => {
      await firstLink.click();
    });
    await check(page, "ならば 記事のページが開き、題の見出しが出る", async () => {
      await expect(page).toHaveURL(/\/articles\/.+/);
      await expect(page.getByTestId("article-title")).toHaveText(/\S/);
    });
  });

  test("記事の一覧は、main のランドマークと h1 を 1 つずつ持つこと", async ({ page }) => {
    await page.goto("/articles");
    await check(page, "ならば main のランドマークと h1 が 1 つずつある", async () => {
      await expect(mainLandmark(page)).toHaveCount(1);
      await expect(pageHeadings(page)).toHaveCount(1);
    });
  });
});
