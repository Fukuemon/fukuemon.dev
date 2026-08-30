import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/graph.ts", "src/toc.ts"],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      reporter: ["text-summary"],
    },
  },
});
