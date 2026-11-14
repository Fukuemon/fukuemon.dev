import type { Page } from "@playwright/test";

/** ヘッダーの「プレイグラウンド」。ヘッダーのリンクは SITE_NAV から並べるので、testid を足さずに名前で拾う */
export const playgroundNavLink = (page: Page) =>
  page.getByTestId("site-header").getByRole("link", { name: "プレイグラウンド", exact: true });
