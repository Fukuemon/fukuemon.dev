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
};

export default config;
