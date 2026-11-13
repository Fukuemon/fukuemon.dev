import { expect, test } from "@playwright/test";

import { docsFrame, sourcePanels } from "../selectors/storybook-docs";

// Button.stories.tsx の export の名前。順は Button.mdx の Canvas の順
const BUTTON_STORIES = [
  "Primary",
  "PrimaryHover",
  "PrimaryFocus",
  "PrimaryDisabled",
  "Secondary",
  "Danger",
  "Loading",
  "SecondaryLoading",
  "Small",
];

test("Button の Docs のページを開いた直後にテーマを選ぶと、全ての story の Show code が story のソースから作ったコードを出す", async ({
  page,
}) => {
  await page.goto("/?path=/docs/コンポーネント-base-button--docs");
  // Docs のページが story を描き終える前に選び、描画の途中で globals が変わる場面にする
  await page.getByRole("button", { name: /^Theme/ }).click();
  await page
    .getByRole("listbox", { name: "Theme" })
    .getByRole("option", { name: "ダーク" })
    .click();

  const frame = docsFrame(page);
  const showCode = frame.getByRole("switch", { name: "Show code" });
  // Canvas が増えたときに開き残さないよう、ページの switch を全て押す
  await showCode.nth(BUTTON_STORIES.length - 1).waitFor();
  const count = await showCode.count();
  // 押した switch は名前が Hide code に変わるので、first() は毎回まだ開いていない次の switch を指す
  for (let i = 0; i < count; i++) await showCode.first().click();

  await expect(sourcePanels(frame)).toHaveText(
    BUTTON_STORIES.map((name) => new RegExp(`^const ${name} = \\(\\) =>[\\s\\S]*<Button`)),
  );
});
