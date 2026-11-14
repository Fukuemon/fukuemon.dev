import type { Locator } from "@playwright/test";

// scroll timeline の進みはフレームごとに取り込まれるので、送った後に 2 フレーム待ってから読む
export const scrollToRatio = async (box: Locator, ratio: number) => {
  await box.evaluate(
    (el, r) =>
      new Promise((done) => {
        el.scrollTo({ left: (el.scrollWidth - el.clientWidth) * r });
        requestAnimationFrame(() => requestAnimationFrame(done));
      }),
    ratio,
  );
};
