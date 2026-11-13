import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    // preview.ts の withThemeByDataAttribute が読む theme の global とツールバーを入れる
    "@storybook/addon-themes",
    // 状態の story で、hover の見た目をマウスを乗せずに出す
    "storybook-addon-pseudo-states",
  ],
  framework: "@storybook/react-vite",
  features: {
    // Show code の source を、描画のたびに作らずビルドのときに作る。Docs の最初の描画の途中でテーマを切り替えると、
    // 描画のたびに作る source が消え、Show code が story の定義（args）を出すためである（#75）
    experimentalCodeExamples: true,
  },
  // _headers を storybook-static の直下に置き、Workers Static Assets に読ませる
  staticDirs: ["./public"],
};

export default config;
