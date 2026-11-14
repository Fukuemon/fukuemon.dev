import { expect, test } from "@playwright/test";

// 吹き出しの位置は CSS で決まるので、ブラウザで描いて矩形を比べる
// 検証用の原稿（page-check）に依存する。原稿を消すときは、この spec の記事も差し替える
test.use({ viewport: { width: 1280, height: 900 } });

test("コピーのボタンを押した場合、吹き出しが 1 行目の字とボタンの枠に重ならないこと", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/articles/page-check/body-and-figure/");

  const frame = page.locator(".expressive-code").filter({ hasText: "article-pages.ts" });
  await frame.hover();
  await frame.getByRole("button", { name: "クリップボードにコピーします" }).click();
  const feedback = frame.getByText("コピーしました");
  await expect(feedback).toHaveClass(/show/);

  const feedbackBox = await feedback.boundingBox();
  const buttonBox = await frame
    .getByRole("button", { name: "クリップボードにコピーします" })
    .boundingBox();
  const firstLine = frame.locator(".ec-line .code").first();
  const lineBox = await firstLine.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { left, right, top, bottom } = range.getBoundingClientRect();
    return { left, right, top, bottom };
  });

  expect(feedbackBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  const overlaps =
    (a: { x: number; y: number; width: number; height: number }) =>
    (b: { left: number; right: number; top: number; bottom: number }) =>
      a.x < b.right && a.x + a.width > b.left && a.y < b.bottom && a.y + a.height > b.top;
  expect(overlaps(feedbackBox!)(lineBox)).toBe(false);
  expect(
    overlaps(feedbackBox!)({
      left: buttonBox!.x,
      right: buttonBox!.x + buttonBox!.width,
      top: buttonBox!.y,
      bottom: buttonBox!.y + buttonBox!.height,
    }),
  ).toBe(false);
});
