import type { Page } from "@playwright/test";

/** ヘッダーの「記事」のリンク。ナビのリンクは `site-nav.ts` の一覧から作るので、testid を足さずに役割と名前で拾う */
export const articlesNavLink = (page: Page) =>
  page.getByTestId("site-header").getByRole("link", { name: "記事" });
