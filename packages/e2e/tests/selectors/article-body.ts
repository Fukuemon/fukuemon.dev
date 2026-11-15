import type { Locator, Page } from "@playwright/test";

// シリーズ「このサイトの記事で使われる構成要素」の記事 article-elements/body-and-figure に依存する。記事の本文を変えるときは、ここの指し方が見る語を残す。

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

export const codeFrame = (page: Page, marker: string): Locator =>
  page.locator(".expressive-code").filter({ hasText: marker });

export const copyButton = (frame: Locator): Locator =>
  frame.getByRole("button", { name: "クリップボードにコピーします" });

export const copyFeedback = (frame: Locator): Locator => frame.locator(".feedback");
