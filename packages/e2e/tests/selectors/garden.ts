import type { Page } from "@playwright/test";

export const htmlElement = (page: Page) => page.locator("html");

export const stations = (page: Page) => page.getByTestId(/^garden-station-\d+$/);

export const navButtons = (page: Page) => page.getByTestId("garden-nav").locator("button");

export const mainCards = (page: Page) => page.locator("main [data-garden-card]");

export const currentCards = (page: Page) => page.locator("[data-garden-card].is-current");

export const notCurrentCards = (page: Page) => page.locator("[data-garden-card]:not(.is-current)");

export const styledCards = (page: Page) => page.locator("[data-garden-card][style]");

export const draggableCards = (page: Page) => page.locator("[data-garden-card][draggable]");

/** イントロの墨の絵の SVG。SVG の文字列はハッシュのテストが固定しているので、testid を足さずに class で拾う */
export const inkSvg = (page: Page) => page.locator(".ink-svg");

/** プロフィールの h1。アクセシビリティツリーに h1 の役割で載ることを確かめるので、役割で拾う */
export const profileHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "プロフィール" });

/** 庭を出さないときの背景の霞。3 つの飾りの要素で testid を持たないので、背景の testid の中を要素名で拾う */
export const backgroundHaze = (page: Page) => page.getByTestId("garden-background").locator("i");
