import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// Vitest が project ごとに設定を書き換えるので、project ごとに新しく作る
const browser = () => ({
  enabled: true,
  provider: playwright(),
  headless: true,
  instances: [{ browser: "chromium" as const }],
});

export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  test: {
    // コンポーネントと story を足すまでは、テストのファイルが無くても通す
    passWithNoTests: true,
    projects: [
      {
        // 押せる領域の大きさとフォーカスの移り方は、描画とブラウザのキーの操作がないと確認できない
        extends: true,
        test: {
          name: "component",
          include: ["src/**/*.test.tsx"],
          browser: browser(),
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
