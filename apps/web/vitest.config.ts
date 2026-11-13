import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // ファイル単位で明示列挙する。列挙し忘れると何もゲートしない
      include: [
        "src/features/top-garden/brush.ts",
        "src/features/top-garden/ink-art.ts",
        "src/features/top-garden/ink-svg.ts",
        "src/features/top-garden/layout.ts",
        "src/features/top-garden/scene-colors.ts",
        "src/features/top-garden/season.ts",
        "src/features/top-garden/sign.ts",
        "src/features/top-garden/stage.ts",
        "src/features/top-garden/visit.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
