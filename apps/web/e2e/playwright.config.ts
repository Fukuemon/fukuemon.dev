import { defineConfig, devices } from "@playwright/test";

const PORT = 4410;

// トップの庭の見た目の回帰の config。ビルドした dist/ を astro preview で配信して流す（context/testing.md）
// 庭は WebGL で描くので、GPU に依らず同じ絵になる SwiftShader で描かせる。基準の画像は Linux で作る（context/testing/e2e.md）
export default defineConfig({
  testDir: "./specs",
  // 基準の画像は Linux の 1 枚だけを持つ。名前に OS を入れない
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec astro preview --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      },
});
