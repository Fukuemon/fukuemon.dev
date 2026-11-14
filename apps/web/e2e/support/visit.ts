import type { Locator, Page } from "@playwright/test";

/** 同じ端末でトップを開いたことがある状態にし、イントロを出さずに庭を出させる */
export const seenBefore = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("fd-top-seen", "1"));

/**
 * 要素の中心の x が画面の幅のどこにあるか（0〜1）を返す。
 * カメラが動いている間は、10 フレームの間に位置が変わるので null を返す。
 */
export const settledCenterX = (el: Locator) =>
  el.evaluate(async (node) => {
    const before = node.getBoundingClientRect();
    for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame);
    const after = node.getBoundingClientRect();
    if (Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 0.5) return null;
    return (after.x + after.width / 2) / innerWidth;
  });
