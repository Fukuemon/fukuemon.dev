import type { Page } from "@playwright/test";

/** 同じ端末でトップを開いたことがある状態にし、イントロを出さずに庭を出させる。キーは `src/features/top-garden/stage/visit.ts` の `fd-top-seen` */
export const seenBefore = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("fd-top-seen", "1"));
