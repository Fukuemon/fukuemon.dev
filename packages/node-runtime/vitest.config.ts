import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // WebContainers はブラウザでしか動かないので、WebContainers を動かす webcontainer/index.ts と、それを import する index.ts は対象に入れない
      exclude: ["src/webcontainer/index.ts", "src/index.ts", "src/test/**", "src/**/*.test.ts"],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
