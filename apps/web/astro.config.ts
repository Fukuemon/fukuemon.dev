import { defineConfig } from "astro/config";
import expressiveCode, { ExpressiveCodeTheme } from "astro-expressive-code";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import { remarkLab } from "./src/lib/remark-lab";
import { rehypeLabSteps } from "./src/lib/rehype-lab-steps";
import { rehypeScrollTable } from "./src/lib/rehype-scroll-table";
import rehypeMermaid from "rehype-mermaid";
import { rehypeMermaidTheme } from "./src/lib/rehype-mermaid-theme";
import { mermaidConfig } from "./src/lib/mermaid-theme";
import { codeThemeDark, codeThemeLight } from "@fukuemon/design-system/code-theme";

export default defineConfig({
  site: "https://fukuemon.dev",
  markdown: {
    remarkPlugins: [remarkLab],
    rehypePlugins: [
      // 図はビルド時に SVG へ落とす。記事に mermaid 本体 (約 300 KiB) を配らない。
      // Expressive Code より前に走るので、まだ素の <pre><code> のまま拾える
      [rehypeMermaid, { strategy: "inline-svg", mermaidConfig }],
      rehypeMermaidTheme,
      rehypeScrollTable,
      rehypeLabSteps,
    ],
  },
  integrations: [
    react(),
    expressiveCode({
      // --c-* を写した自前のテーマ。全トークンが 4.5:1 を満たす
      themes: [new ExpressiveCodeTheme(codeThemeLight), new ExpressiveCodeTheme(codeThemeDark)],
      // 自前で 4.5:1 を満たしているので、自動補正で梯子を崩させない
      minSyntaxHighlightingColorContrast: 0,
      styleOverrides: {
        borderColor: "var(--rule-strong)",
        borderRadius: "0",
        codeBackground: "var(--code-bg)",
        codeFontFamily: "var(--font-mono)",
        frames: {
          frameBoxShadowCssValue: "none",
          editorTabBarBackground: "var(--code-bg)",
          editorActiveTabBackground: "var(--code-bg)",
          editorActiveTabIndicatorTopColor: "var(--green)",
          editorActiveTabBorderColor: "var(--rule-strong)",
          editorBackground: "var(--code-bg)",
          terminalBackground: "var(--code-bg)",
          terminalTitlebarBackground: "var(--code-bg)",
          tooltipSuccessBackground: "var(--green)",
        },
        textMarkers: {
          markBackground: "var(--tint-green)",
          markBorderColor: "var(--green)",
          lineMarkerAccentWidth: "2px",
        },
      },
    }),
    mdx(),
  ],
});
