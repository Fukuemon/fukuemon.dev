import { expect, test } from "@playwright/test";

import { docsFrame, sourcePanels } from "../selectors/storybook-docs";

// Button.stories.tsx の export の名前と、Docs のページに並ぶ順
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
  // 押した switch は名前が Hide code に変わるので、first() は毎回まだ開いていない次の switch を指す
  for (let i = 0; i < BUTTON_STORIES.length; i++) await showCode.first().click();

  await expect(sourcePanels(frame)).toHaveText(
    BUTTON_STORIES.map((name) => new RegExp(`^const ${name} = \\(\\) =>[\\s\\S]*<Button`)),
  );
});
