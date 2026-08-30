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
        "src/components/lab/progress.ts",
        "src/components/lab/sql-tokens.ts",
        "src/components/lab/cell.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary", "text"],
    },
  },
});
