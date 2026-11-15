import { guestBundle } from "@fukuemon/node-runtime/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // テストが import する @fukuemon/node-runtime は、DB のプロセスのスクリプトを束ねて読む
  plugins: [guestBundle()],
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ["text-summary"],
    },
  },
});
