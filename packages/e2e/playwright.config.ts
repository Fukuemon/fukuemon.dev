import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("空きポートを取得できなかった"));
      });
    });
  });
}

// worker は config を読み直すので、最初に決めたポートを環境変数に残して同じポートを使わせる
function resolvePort(): number {
  const port = Number(process.env.PREVIEW_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PREVIEW_PORT が不正: ${process.env.PREVIEW_PORT}`);
  }
  return port;
}

// BASE_URL を渡したときは配信を立てないので、ポートを決めない
if (!process.env.BASE_URL && process.env.PREVIEW_PORT === undefined) {
  process.env.PREVIEW_PORT = String(await findFreePort());
}
const PORT = process.env.BASE_URL ? 0 : resolvePort();

// サイトの E2E の config。ビルドした apps/web/dist/ を astro preview で配信して流し、dev server を対象にしない（context/testing.md）
// BASE_URL を渡したときは配信を立てない。渡した URL のサイトは、流す人が先に立てておく
export default defineConfig({
  testDir: "./tests/specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      // トップの庭の見た目の回帰と、記事のページの表と図の枠。tests/ の外に置くので、E2E の lint の規則は掛からない
      // 庭は WebGL で描くので、GPU に依らず同じ絵になる SwiftShader で描かせる。基準の画像は Linux で作る（context/testing/e2e.md）
      name: "visual",
      testDir: "./visual/specs",
      testMatch: "**/*.spec.ts",
      // 庭の spec は、同じファイルの中のテストを直列で流す。SwiftShader の描画が重いため
      fullyParallel: false,
      // 基準の画像は Linux の 1 枚だけを持つ。名前に OS を入れない
      snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Astro はコーディングエージェントの中で preview を裏に回して終わるので、Playwright が配信の終了とみなす。--ignore-lock で前に置いたままにする
        command: `pnpm exec astro preview --port ${PORT} --strictPort --ignore-lock`,
        cwd: "../../apps/web",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      },
});
