import { expect, test } from "@playwright/test";

import { codeFrame, copyButton, copyFeedback } from "../../selectors/article-body";

// 吹き出しの位置は CSS で決まるので、ブラウザで描いて矩形を比べる
test.use({ viewport: { width: 1280, height: 900 } });

test.describe("記事のページ", () => {
  test.describe("コードブロックのコピーの吹き出し", () => {
    for (const [name, marker] of [
      ["ファイル名の帯のある", "article-pages.ts"],
      ["段落の直後の、ファイル名の帯のない", "untitledArticleHref"],
      ["見出しの直後の、ファイル名の帯のない", "headingFollowedHref"],
    ] as const) {
      test(`${name}コードブロックのコピーのボタンを押した場合、吹き出しが 1 行目の字とボタンと直前のブロックに重ならないこと`, async ({
        page,
        context,
      }) => {
        await context.grantPermissions(["clipboard-write"]);
        await page.goto("/articles/page-check/body-and-figure/");

        const frame = codeFrame(page, marker);
        await frame.scrollIntoViewIfNeeded();
        await frame.hover();
        await copyButton(frame).click();
        await expect(copyFeedback(frame)).toBeVisible();

        // 矩形は吹き出しが消え始めても変わらないので、1 回の評価で、消える前にまとめて読む
        const overlaps = await frame.evaluate((el) => {
          const feedback = el.querySelector(".feedback")!.getBoundingClientRect();
          const button = el.querySelector(".copy button")!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el.querySelector(".ec-line .code")!);
          const firstLine = range.getBoundingClientRect();
          const previous = el.previousElementSibling!.getBoundingClientRect();
          const intersects = (a: DOMRect, b: DOMRect) =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          return {
            firstLine: intersects(feedback, firstLine),
            button: intersects(feedback, button),
            previousBlock: intersects(feedback, previous),
          };
        });

        expect(overlaps).toStrictEqual({ firstLine: false, button: false, previousBlock: false });
      });
    }
  });
});
