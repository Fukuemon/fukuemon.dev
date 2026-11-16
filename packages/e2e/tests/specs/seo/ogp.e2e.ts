import { expect, test } from "@playwright/test";

import { check } from "../../fixtures/caption";
import { ogMeta } from "../../selectors/ogp";

const OG_PROPERTIES = [
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:type",
  "twitter:card",
];

test.describe("OGP", () => {
  for (const path of ["/", "/articles", "/playground"]) {
    test(`${path} の HTML は、OGP の meta を揃え、共通の画像を指すこと`, async ({ page }) => {
      await page.goto(path);
      await check(page, "ならば OGP の meta が揃い、画像は共通の 1 枚を指す", async () => {
        for (const property of OG_PROPERTIES)
          await expect(ogMeta(page, property)).toHaveAttribute("content", /\S/);
        await expect(ogMeta(page, "og:image")).toHaveAttribute(
          "content",
          "https://fukuemon.dev/og/default.png",
        );
        await expect(ogMeta(page, "og:type")).toHaveAttribute("content", "website");
      });
    });
  }

  test("記事のページの og:image は、その記事の 1200×630 の画像を指し、画像が 200 を返すこと", async ({
    page,
    request,
  }) => {
    await page.goto("/articles");
    await page.getByTestId("article-link").first().click();
    await expect(page.getByTestId("article-title")).toHaveText(/\S/);
    const slug = new URL(page.url()).pathname.replace(/^\/articles\/|\/$/g, "");

    await check(page, "ならば OGP の meta が揃い、画像は記事の id の PNG を指す", async () => {
      for (const property of OG_PROPERTIES)
        await expect(ogMeta(page, property)).toHaveAttribute("content", /\S/);
      await expect(ogMeta(page, "og:type")).toHaveAttribute("content", "article");
      await expect(ogMeta(page, "og:image")).toHaveAttribute(
        "content",
        `https://fukuemon.dev/og/articles/${slug}.png`,
      );
    });

    // og:image は本番の絶対 URL なので、同じパスを配信中のサイトから取得する
    const res = await request.get(`/og/articles/${slug}.png`);
    expect(res.status()).toBe(200);
    const png = await res.body();
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
