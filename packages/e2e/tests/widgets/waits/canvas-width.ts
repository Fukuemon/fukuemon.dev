import type { Page } from "@playwright/test";

/** 庭は、描く直前に canvas の大きさを画面に合わせる。幅が合うまで待つ */
export const waitForGardenCanvasWidth = (page: Page, width: number) =>
  page.waitForFunction(
    (w) => document.querySelector<HTMLCanvasElement>("[data-garden-stage] canvas")?.width === w,
    width,
  );
