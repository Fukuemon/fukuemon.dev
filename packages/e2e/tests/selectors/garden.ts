import type { Page } from "@playwright/test";

export const htmlElement = (page: Page) => page.locator("html");

export const stations = (page: Page) => page.getByTestId(/^garden-station-\d+$/);

export const navButtons = (page: Page) => page.getByTestId("garden-nav").locator("button");

export const mainCards = (page: Page) => page.locator("main [data-garden-card]");

export const currentCards = (page: Page) => page.locator("[data-garden-card].is-current");

export const notCurrentCards = (page: Page) => page.locator("[data-garden-card]:not(.is-current)");

export const styledCards = (page: Page) => page.locator("[data-garden-card][style]");

export const draggableCards = (page: Page) => page.locator("[data-garden-card][draggable]");
