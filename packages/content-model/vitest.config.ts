import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // ファイル単位で明示列挙する。列挙し忘れると何もゲートしない
      include: ["src/graph.ts", "src/toc.ts"],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      reporter: ["text-summary"],
    },
  },
});
