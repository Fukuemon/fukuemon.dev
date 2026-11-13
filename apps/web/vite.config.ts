import { defineConfig } from "vite-plus";

// vp run のタスクだけを置く。Astro の build を vp build で置き換えない (ADR-0003)。
// 入口は package.json の build で、vp を外すときはそこへコマンドを戻す (ADR-0017)
export default defineConfig({
  run: {
    tasks: {
      "build:site": {
        command: "astro build",
        cache: {
          // .astro/ と dist/ は astro build が書くので、入力に含めると毎回外れる
          input: [{ auto: true }, "!.astro/**", "!dist/**"],
          // 自動の記録は dist/_astro/ を拾わず、dist/ を消した後のキャッシュヒットで資産が欠ける
          output: ["dist/**"],
        },
      },
    },
  },
});
