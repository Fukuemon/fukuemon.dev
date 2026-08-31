import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // ファイル単位で明示列挙する。列挙し忘れると何もゲートしない
      include: [
        "src/lib/tate.ts",
        "src/lib/remark-lab.ts",
        "src/lib/rehype-lab-steps.ts",
        "src/features/lab/steps/progress.ts",
        "src/features/lab/steps/bootSpec.ts",
        "src/features/lab/editor/sql-tokens.ts",
        "src/features/lab/runtime/cell.ts",
        "src/features/lab/catalog/catalog.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary", "text"],
    },
  },
});
