import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import { remarkLab } from "./src/lib/remark-lab";
import { RUNNERS } from "./src/features/lab/runners";
import { rehypeLabSteps } from "./src/lib/rehype-lab-steps";
import { rehypeScrollTable } from "./src/lib/rehype-scroll-table";
import rehypeMermaid from "rehype-mermaid";
import { rehypeMermaidTheme } from "./src/lib/rehype-mermaid-theme";
import { mermaidConfig } from "./src/lib/mermaid-theme";
import { codeThemeDark, codeThemeLight } from "@fukuemon/design-system/code-theme";

export default defineConfig({
  site: "https://fukuemon.dev",
  vite: { plugins: [tailwindcss()] },
  markdown: {
    remarkPlugins: [[remarkLab, { runners: RUNNERS }]],
    rehypePlugins: [
      // 図はビルド時に SVG へ変換する。記事に mermaid 本体 (約 300 KiB) を配らない。
      // Expressive Code より前に実行されるので、まだ素の <pre><code> のまま処理できる
      [rehypeMermaid, { strategy: "inline-svg", mermaidConfig }],
      rehypeMermaidTheme,
      rehypeScrollTable,
      rehypeLabSteps,
    ],
  },
  integrations: [
    react(),
    expressiveCode({
      // --color-c-* を写した自前のテーマ。全トークンが 4.5:1 を満たす
      themes: [new ExpressiveCodeTheme(codeThemeLight), new ExpressiveCodeTheme(codeThemeDark)],
      // 自前で 4.5:1 を満たしているので、自動補正で梯子を崩させない
      minSyntaxHighlightingColorContrast: 0,
      styleOverrides: {
        borderColor: "var(--color-rule-strong)",
        borderRadius: "0",
        codeBackground: "var(--color-code-bg)",
        codeFontFamily: "var(--font-mono)",
        frames: {
          frameBoxShadowCssValue: "none",
          editorTabBarBackground: "var(--color-code-bg)",
          editorActiveTabBackground: "var(--color-code-bg)",
          editorActiveTabIndicatorTopColor: "var(--color-green)",
          editorActiveTabBorderColor: "var(--color-rule-strong)",
          editorBackground: "var(--color-code-bg)",
          terminalBackground: "var(--color-code-bg)",
          terminalTitlebarBackground: "var(--color-code-bg)",
          tooltipSuccessBackground: "var(--color-green)",
        },
        textMarkers: {
          markBackground: "var(--color-tint-green)",
          markBorderColor: "var(--color-green)",
          lineMarkerAccentWidth: "2px",
        },
      },
    }),
    mdx(),
  ],
});
