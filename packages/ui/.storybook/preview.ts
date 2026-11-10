import type { Preview } from "@storybook/react-vite";

import "./preview.css";

const preview: Preview = {
  parameters: {
    // a11y のアドオンの違反を、Vitest で動かす story のテストの失敗にする
    a11y: { test: "error" },
    options: {
      storySort: {
        // packages/ui/DesignDoc.md の「カタログ」のページの順
        order: ["はじめに", "トークン", "コンポーネント", ["Base", "Case"], "パターン", "画面"],
      },
    },
  },
};

export default preview;
