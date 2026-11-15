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

/** 経歴の行の、詳細を開閉する summary。行ごとに testid を足さず、経歴の和紙の中の summary を順に拾う */
export const careerSummaries = (page: Page) =>
  page.getByTestId("garden-card-career").locator("summary");

export const openedCareerDetails = (page: Page) =>
  page.getByTestId("garden-card-career").locator("details[open]");

/** ページの本文のランドマーク。WCAG 2.4.1 をランドマークと見出しで満たすことを確かめるので、役割で拾う */
export const mainLandmark = (page: Page) => page.getByRole("main");

/** ページの h1。ランドマークと同じく、アクセシビリティツリーでの役割を確かめるので、役割で拾う */
export const pageHeadings = (page: Page) => page.getByRole("heading", { level: 1 });
