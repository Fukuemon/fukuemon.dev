import type { Page } from "@playwright/test";

/** 同じ端末でトップを開いたことがある状態にし、イントロを出さずに庭を出させる */
export const seenBefore = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("fd-top-seen", "1"));
