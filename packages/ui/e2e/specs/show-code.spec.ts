import { expect, test } from "@playwright/test";

import { docsFrame, sourcePanels } from "../selectors/storybook-docs";

const STORIES = [
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

test.describe("カタログの Docs のページ", () => {
  test("Docs のページを開いた直後にテーマを選んだ場合、全ての story の Show code が story の JSX を出すこと", async ({
    page,
  }) => {
    await page.goto("/?path=/docs/コンポーネント-base-button--docs");
    // Docs のページが story を描き終える前に選ぶ。描いている途中で globals が変わると、描画のときに作る source が消える
    await page.getByRole("button", { name: /^Theme/ }).click();
    await page
      .getByRole("listbox", { name: "Theme" })
      .getByRole("option", { name: "ダーク" })
      .click();

    const frame = docsFrame(page);
    const showCode = frame.getByRole("switch", { name: "Show code" });
    await expect(showCode).toHaveCount(STORIES.length);
    for (let i = 0; i < STORIES.length; i++) await showCode.first().click();

    const panels = sourcePanels(frame);
    await expect(panels).toHaveCount(STORIES.length);
    for (const [i, name] of STORIES.entries()) {
      await expect(panels.nth(i)).toHaveText(
        new RegExp(`^const ${name} = \\(\\) =>[\\s\\S]*<Button`),
      );
    }
  });
});
