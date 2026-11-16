import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import fontCss from "@fontsource/zen-old-mincho/600.css?raw";
import tokensCss from "@fukuemon/ui/tokens.gen.css?raw";
import inkSvg from "../../components/ink-background/ink-background.svg?raw";
import { ogText, parseFontSlices, renderOgImage, resolveColors, slicesFor } from "./og-image";

const fontDir = dirname(
  createRequire(import.meta.url).resolve("@fontsource/zen-old-mincho/600.css"),
);
const colors = resolveColors(tokensCss);
const slices = parseFontSlices(fontCss);

/** ページの OGP の画像の PNG を、ビルドのときに描いて Response で返す */
export async function ogImageResponse(title?: string): Promise<Response> {
  const fonts = await Promise.all(
    slicesFor(ogText(title), slices).map(async (s) => {
      const b = await readFile(join(fontDir, "files", s.file));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    }),
  );
  const png = await renderOgImage(title, { colors, inkSvg, fonts });
  return new Response(png as BodyInit, { headers: { "Content-Type": "image/png" } });
}
