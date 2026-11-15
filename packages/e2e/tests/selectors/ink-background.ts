import type { Page } from "@playwright/test";

/** 薄墨の背景の絵。トップ（庭を出さないとき）、記事の一覧、プレイグラウンドの一覧に出る */
export const inkBackground = (page: Page) => page.getByTestId("ink-background");

/** 背景の霞。3 つの飾りの要素で testid を持たないので、背景の testid の中を要素名で拾う */
export const backgroundHaze = (page: Page) => inkBackground(page).locator("i");

/** ページの body。背景の色を html に移したかを確かめるので、要素名で拾う */
export const bodyElement = (page: Page) => page.locator("body");
