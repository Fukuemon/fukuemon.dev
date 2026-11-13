import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/files.ts",
        "src/output.ts",
        "src/processes.ts",
        "src/runtime.ts",
        "src/store.ts",
      ],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
