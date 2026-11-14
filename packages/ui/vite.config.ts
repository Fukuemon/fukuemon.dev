import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// Vitest が project ごとに設定を書き換えるので、project ごとに新しく作る
const browser = (contextOptions?: { hasTouch: boolean }) => ({
  enabled: true,
  provider: playwright({ contextOptions }),
  headless: true,
  instances: [{ browser: "chromium" as const }],
});

export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  // テストの途中で最適化すると Vite がテストを読み直し、CI の初回の実行が失敗する
  optimizeDeps: { include: ["react-dom/server"] },
  test: {
    projects: [
      {
        // 押せる領域の大きさとフォーカスの移り方は、描画とブラウザのキーの操作がないと確認できない
        extends: true,
        test: {
          name: "component",
          include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
          exclude: ["src/**/*.coarse.test.tsx"],
          setupFiles: ["src/test/setup.ts"],
          browser: browser(),
        },
      },
      {
        // 触る端末の押せる領域は、Chromium のタッチのエミュレーションで pointer: coarse にして確かめる（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）
        extends: true,
        test: {
          name: "component-coarse",
          include: ["src/**/*.coarse.test.tsx"],
          setupFiles: ["src/test/setup.ts"],
          browser: browser({ hasTouch: true }),
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: { name: "storybook", browser: browser() },
      },
    ],
  },
});
