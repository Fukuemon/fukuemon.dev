import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://fukuemon.dev",
  vite: {
    plugins: [tailwindcss()],
    // 小さいフォントのスライスを base64 で CSS に埋めさせない。
    // 埋めると、そのページで使わないスライスまで、描画を止める CSS と一緒に配ることになる
    build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  },
});
