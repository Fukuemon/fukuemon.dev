import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // ファイル単位で明示列挙する。列挙し忘れると何もゲートしない
      include: [
        "src/components/site-nav.ts",
        "src/lib/subset-fonts.ts",
        "src/features/top-garden/ink/brush.ts",
        "src/features/top-garden/ink/ink-art.ts",
        "src/features/top-garden/ink/ink-svg.ts",
        "src/features/top-garden/layout.ts",
        "src/features/top-garden/rng.ts",
        "src/features/top-garden/scene/scene-colors.ts",
        "src/features/top-garden/stage/season.ts",
        "src/components/sign/sign.ts",
        "src/features/top-garden/stage/stage.ts",
        "src/features/top-garden/stage/visit.ts",
        "src/lib/content/article-list.ts",
        "src/lib/content/article-pages.ts",
        "src/lib/content/rss.ts",
        "src/lib/rehype-ja-linebreak.ts",
        "src/lib/rehype-mermaid.ts",
        "src/lib/rehype-scroll-box.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
