import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { guestBundle } from "@fukuemon/node-runtime/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { type Connect, type Plugin, defineConfig } from "vite";

// ツールは、index.html を持つディレクトリから読む。oxlint.config.ts も同じ方法で読む
const tools = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(import.meta.dirname, d.name, "index.html")))
  .map((d) => d.name);

// public/_headers は Cloudflare でだけ働く。手元の vp dev と vp preview でも、/node/ に同じ isolation のヘッダを返す
const isolate = (server: { middlewares: Connect.Server }) => {
  server.middlewares.use((request, response, next) => {
    if (request.url?.startsWith("/node/")) {
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    }
    next();
  });
};
const isolationHeaders: Plugin = {
  name: "node-isolation-headers",
  configureServer: isolate,
  configurePreviewServer: isolate,
};

export default defineConfig({
  // React Compiler は apps/playground にだけ入れる。外すときは babel の plugin を消す (ADR-0047)
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    isolationHeaders,
    guestBundle(),
  ],
  // PGlite は .wasm と .data を import.meta.url から相対で読むので、事前のバンドルから外す
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: {
    // フォントを CSS に埋めると、使わない文字の範囲まで描画を止める CSS と一緒に配る。apps/web と同じ扱いにする
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
    rollupOptions: {
      input: Object.fromEntries(
        tools.map((tool) => [tool, join(import.meta.dirname, tool, "index.html")]),
      ),
      output: {
        // エディタは SQL、Node、Go、スライドのページが使う。1 つのチャンクにして、ページの間でキャッシュを共有する
        advancedChunks: {
          groups: [
            {
              name: "code-editor",
              test: /node_modules[\\/](@codemirror|@lezer|@replit|crelt|style-mod|w3c-keyname)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
