import type { Page } from "@playwright/test";

// トップのプロフィールの活動のリンク。apps/web/src/features/top-garden/Profile.astro の並びと同じ順にする
export const PROFILE_ACTIVITIES = [
  { name: "GDG Greater Kwansai", url: "https://x.com/gdgkwansai" },
  { name: "Alpha+Project", url: "https://greek-academy.org/" },
] as const;

/** 活動のリンクの先へのリクエストに空のページを返す。団体のページを E2E から開かない */
export const stubActivityPages = (page: Page) =>
  Promise.all(
    PROFILE_ACTIVITIES.map(({ url }) =>
      page.route(`${url}**`, (route) =>
        route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" }),
      ),
    ),
  );
