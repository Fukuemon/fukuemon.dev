import { expect, test } from "@playwright/test";

import { PROFILE_ACTIVITIES, stubActivityPages } from "../../fixtures/profile";
import { mainCards, mainLandmark } from "../../selectors/garden";

test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test.describe("トップの庭", () => {
  test.describe("WebGL が使えない場合", () => {
    test("トップを開いた場合、庭を出さずにふつうのページを出すこと", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("garden-stage")).toBeHidden();
    });

    test("トップを開いた場合、技術スタックの文と活動の役職を出さず、活動を団体の名前のリンクで出すこと", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(mainCards(page)).toHaveCount(3);
      await expect(mainLandmark(page)).not.toContainText("技術スタック");
      await expect(mainLandmark(page)).not.toContainText(/organizer|HackBar|\bTA\b/);
      await expect(page.getByTestId("profile-activity-link")).toHaveText(
        PROFILE_ACTIVITIES.map(({ name }) => name),
      );
    });

    for (const [index, activity] of PROFILE_ACTIVITIES.entries()) {
      test(`${activity.name} のリンクを押した場合、団体のページを同じタブで開くこと`, async ({
        page,
      }) => {
        await stubActivityPages(page);
        await page.goto("/");
        const link = page.getByTestId("profile-activity-link").nth(index);
        await expect(link).not.toHaveAttribute("target");
        await link.click();
        await expect(page).toHaveURL(activity.url);
      });
    }
  });
});
