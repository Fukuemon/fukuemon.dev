import { defineConfig, devices } from "@playwright/test";

const PORT = 4415;

// 記事のページの E2E の config。ビルドした dist/ を astro preview で配信して流す（context/testing.md）
export default defineConfig({
  testDir: "./specs",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec astro preview --port ${PORT} --ignore-lock`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      },
});
