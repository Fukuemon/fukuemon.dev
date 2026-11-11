import { defineConfig, devices } from "@playwright/test";

const PORT = 6126;

// カタログの E2E の config。Storybook の静的ビルドを vite preview で配信して流し、dev server を対象にしない（context/testing.md）
// BASE_URL を渡したときは配信を立てない。渡した URL のカタログは、流す人が先に立てておく
export default defineConfig({
  // pull request の動作確認の spec は、下書きの置き場（.ai-out/evidence/prs/<番号>/specs/）を SPECS_DIR で渡して流す
  testDir: process.env.SPECS_DIR ?? "./specs",
  fullyParallel: true,
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
        command: `pnpm run build-storybook --quiet && pnpm exec vite preview --outDir storybook-static --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        timeout: 300_000,
        reuseExistingServer: false,
      },
});
