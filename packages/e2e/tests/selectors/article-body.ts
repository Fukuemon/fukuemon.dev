import type { Locator, Page } from "@playwright/test";

// 検証用の原稿（page-check）に依存する。原稿を消すときは、ここの指し方も差し替える。

export const smallTable = (page: Page): Locator =>
  page
    .getByRole("region", { name: "表" })
    .filter({ has: page.getByRole("columnheader", { name: "項目" }) });

export const wideTable = (page: Page): Locator =>
  page
    .getByRole("region", { name: "表" })
    .filter({ has: page.getByRole("columnheader", { name: "列 6" }) });

export const figure = (page: Page): Locator => page.getByRole("region", { name: "図" });

export const shortCode = (page: Page): Locator =>
  page.locator(".expressive-code pre").filter({ hasText: "web build" });

export const longCode = (page: Page): Locator =>
  page.locator(".expressive-code pre").filter({ hasText: "--devOutput" });
