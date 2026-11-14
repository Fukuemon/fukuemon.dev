import { expect, test } from "@playwright/test";

// 吹き出しの位置は CSS で決まるので、ブラウザで描いて矩形を比べる
// 検証用の原稿（page-check）に依存する。原稿を消すときは、この spec の記事も差し替える
test.use({ viewport: { width: 1280, height: 900 } });

const COPY_BUTTON = "クリップボードにコピーします";

for (const [name, marker] of [
  ["ファイル名の帯のある", "article-pages.ts"],
  ["ファイル名の帯のない", "untitledArticleHref"],
] as const) {
  test(`${name}コードブロックのコピーのボタンを押すと、吹き出しが 1 行目の字とボタンに重ならない`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-write"]);
    await page.goto("/articles/page-check/body-and-figure/");

    const frame = page.locator(".expressive-code").filter({ hasText: marker });
    const button = frame.getByRole("button", { name: COPY_BUTTON });
    await frame.scrollIntoViewIfNeeded();
    await frame.hover();
    await button.click();
    await frame.locator(".feedback").waitFor();

    // 矩形は吹き出しが消え始めても変わらないので、1 回の評価で、消える前に 3 つをまとめて読む
    const overlaps = await frame.evaluate((el) => {
      const feedback = el.querySelector(".feedback")!.getBoundingClientRect();
      const copyButton = el.querySelector(".copy button")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el.querySelector(".ec-line .code")!);
      const firstLine = range.getBoundingClientRect();
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        firstLine: intersects(feedback, firstLine),
        button: intersects(feedback, copyButton),
      };
    });

    expect(overlaps).toStrictEqual({ firstLine: false, button: false });
  });
}
