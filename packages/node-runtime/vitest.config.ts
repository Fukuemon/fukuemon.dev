import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "vite.ts"],
      // WebContainers はブラウザでしか動かないので、WebContainers を動かす webcontainer/index.ts と、それを import する index.ts は対象に入れない
      // DB のプロセスのスクリプトは、実行環境の中の Node でだけ動く
      exclude: [
        "src/webcontainer/index.ts",
        "src/index.ts",
        "src/guest/db-server.ts",
        "src/test/**",
        "src/**/*.test.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
