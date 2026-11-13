import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { unified } from "@astrojs/markdown-remark";
import expressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code";
import { toVsCodeTheme } from "@fukuemon/ui";
import { rehypeJaLinebreak } from "./src/lib/rehype-ja-linebreak";
import { rehypeMermaid } from "./src/lib/rehype-mermaid";

export default defineConfig({
  site: "https://fukuemon.dev",
  vite: {
    plugins: [tailwindcss()],
    // 小さいフォントのスライスを base64 で CSS に埋めさせない。
    // 埋めると、そのページで使わないスライスまで、描画を止める CSS と一緒に配ることになる
    build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  },
  markdown: {
    // 既定の Sätteri は rehype のプラグインを動かさないので、unified の処理に替える。
    // rehypeMermaid は Expressive Code より前に動き、素の <pre><code> のまま図を拾う
    processor: unified({ rehypePlugins: [rehypeMermaid, rehypeJaLinebreak] }),
  },
  integrations: [
    react(),
    expressiveCode({
      themes: [
        new ExpressiveCodeTheme(toVsCodeTheme("light")),
        new ExpressiveCodeTheme(toVsCodeTheme("dark")),
      ],
      // トークンの側で全ての色が 4.5:1 を満たすので、自動の補正で色を変えさせない
      minSyntaxHighlightingColorContrast: 0,
      styleOverrides: {
        borderColor: "var(--color-border)",
        borderRadius: "0",
        codeFontFamily: "var(--font-mono)",
        uiFontFamily: "var(--font-sans)",
        frames: {
          frameBoxShadowCssValue: "none",
          editorTabBarBackground: "var(--color-code-surface)",
          editorTabBarBorderBottomColor: "var(--color-border)",
          editorActiveTabBackground: "var(--color-code-surface)",
          editorActiveTabForeground: "var(--color-code-text)",
          editorActiveTabBorderColor: "var(--color-border)",
          editorActiveTabIndicatorTopColor: "var(--color-primary)",
          terminalTitlebarBackground: "var(--color-code-surface)",
          terminalTitlebarBorderBottomColor: "var(--color-border)",
          terminalTitlebarForeground: "var(--color-code-text)",
          terminalTitlebarDotsForeground: "var(--color-border-field)",
        },
      },
    }),
  ],
});
