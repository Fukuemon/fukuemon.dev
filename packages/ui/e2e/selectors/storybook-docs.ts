import type { FrameLocator, Locator, Page } from "@playwright/test";

/** Storybook の manager が Docs のページを描く iframe */
export const docsFrame = (page: Page): FrameLocator =>
  page.frameLocator("#storybook-preview-iframe");

/** Docs のページの Canvas ごとの Show code の source。Storybook が描く DOM で、testid を付けられない */
export const sourcePanels = (frame: FrameLocator): Locator =>
  frame.locator(".sbdocs-preview pre.prismjs");
