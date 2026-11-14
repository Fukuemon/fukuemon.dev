import type { Page } from "@playwright/test";

/** 2 枚の PNG の画素の差の平均（0〜255）を、ブラウザの 2D canvas で求める */
export const meanDiff = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(
    async (pngs) => {
      const [pa, pb] = await Promise.all(
        pngs.map(async (b64) => {
          const img = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${b64}`)).blob(),
          );
          const ctx = new OffscreenCanvas(img.width, img.height).getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, img.width, img.height).data;
        }),
      );
      return pa!.reduce((sum, v, i) => sum + Math.abs(v - pb![i]!), 0) / pa!.length;
    },
    [a.toString("base64"), b.toString("base64")],
  );
