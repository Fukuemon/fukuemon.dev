import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { unified } from "@astrojs/markdown-remark";
import expressiveCode, { ExpressiveCodeTheme, pluginFramesTexts } from "astro-expressive-code";
import { toVsCodeTheme } from "@fukuemon/ui/code-theme";
import { rehypeJaLinebreak } from "./src/lib/rehype-ja-linebreak";
import { rehypeMermaid } from "./src/lib/rehype-mermaid";
import { playgroundIsolationHeaders } from "./src/lib/playground/isolation-headers";
import { rehypePlayground } from "./src/lib/playground/rehype-playground";
import { rehypeScrollBox } from "./src/lib/rehype-scroll-box";

// サイトの UI の文言は、ですます調の日本語にする (context/conventions.md)
pluginFramesTexts.overrideTexts(undefined, {
  copyButtonTooltip: "クリップボードにコピーします",
  copyButtonCopied: "コピーしました",
});
import { subsetFonts } from "./src/lib/subset-fonts";

export default defineConfig({
  site: "https://fukuemon.dev",
  vite: {
    plugins: [tailwindcss()],
    // 小さいフォントのスライスを base64 で CSS に埋めさせない。
    // 埋めると、そのページで使わないスライスまで、描画を止める CSS と一緒に配ることになる
    build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  },
  markdown: {
    // デフォルトの Sätteri は rehype のプラグインを動かさないので、unified の処理に替える。
    // rehypeMermaid は Expressive Code より前に動き、素の <pre><code> のまま図を拾う
    processor: unified({
      rehypePlugins: [rehypePlayground, rehypeMermaid, rehypeScrollBox, rehypeJaLinebreak],
    }),
  },
  integrations: [
    subsetFonts("Zen Old Mincho"),
    playgroundIsolationHeaders(),
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
        borderWidth: "1px",
        borderRadius: "0",
        // text-code（16px、行高 170%）と text-caption（14px）に合わせる。テーマ変数はこの設定の CSS に届かない
        codeFontFamily: "var(--font-mono)",
        codeFontSize: "1rem",
        codeLineHeight: "1.7",
        uiFontFamily: "var(--font-sans)",
        uiFontSize: "0.875rem",
        focusBorder: "var(--color-focus)",
        frames: {
          frameBoxShadowCssValue: "none",
          editorTabBarBackground: "var(--color-code-surface)",
          editorTabBarBorderBottomColor: "var(--color-border)",
          editorActiveTabBackground: "var(--color-code-surface)",
          editorActiveTabForeground: "var(--color-code-text)",
          editorActiveTabBorderColor: "var(--color-border)",
          editorActiveTabIndicatorTopColor: "var(--color-primary)",
          editorActiveTabIndicatorHeight: "2px",
          terminalTitlebarBackground: "var(--color-code-surface)",
          terminalTitlebarBorderBottomColor: "var(--color-border)",
          terminalTitlebarForeground: "var(--color-code-text)",
          terminalTitlebarDotsForeground: "var(--color-border-field)",
          terminalTitlebarDotsOpacity: "1",
          // packages/ui の IconButton と同じく、面と枠を持たず、hover とフォーカスのときだけ面を付ける
          inlineButtonBackground: "var(--color-surface-subtle)",
          inlineButtonBackgroundIdleOpacity: "0",
          inlineButtonBackgroundHoverOrFocusOpacity: "1",
          inlineButtonBackgroundActiveOpacity: "1",
          inlineButtonBorderOpacity: "0",
          inlineButtonForeground: "var(--color-text)",
          tooltipSuccessBackground: "var(--color-success-surface)",
          tooltipSuccessForeground: "var(--color-text)",
        },
      },
    }),
  ],
});
