/**
 * 全ページを明暗 2 配色 × 2 幅で撮る。
 * ADR-0010 が定めた「見た目を変えないことを目視で確かめない」ための道具。
 *
 *   pnpm run shot <出力先>
 *
 * 変更の前後で 2 回撮り、`pnpm run shot:diff <前> <後>` で突き合わせる。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { PAGES, THEMES, WIDTHS, shotName } from "./pages.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out) throw new Error("出力先を渡してください: pnpm run shot <dir>");
  await mkdir(out, { recursive: true });

  const browser = await chromium.launch();
  let n = 0;
  try {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        const page = await ctx.newPage();
        for (const path of PAGES) {
          const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
          if (!res?.ok()) throw new Error(`${path} が ${res?.status()} を返しました`);
          const buf = await page.screenshot({ fullPage: true });
          await writeFile(join(out, shotName(path, theme, width)), buf);
          n += 1;
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${n} 枚を ${out} に置きました`);
}

await main();
