import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("空きポートを取得できなかった"));
      });
    });
  });
}

// 空きポートは最初の 1 回だけ決める。worker は config を読み直すので、決めた値を環境変数に残して同じポートを使わせる
// PREVIEW_PORT を渡したときは、そのポートを使う
const PORT = Number(process.env.PREVIEW_PORT ?? (await findFreePort()));
process.env.PREVIEW_PORT = String(PORT);

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
        command: `pnpm exec astro preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      },
});
