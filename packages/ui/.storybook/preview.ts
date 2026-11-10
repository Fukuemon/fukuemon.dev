import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import "./preview.css";

const preview: Preview = {
  // ツールバーでテーマを切り替える。ダークは semantic-dark.css の [data-theme="dark"] のブロックが効く
  decorators: [
    withThemeByDataAttribute({
      themes: { ライト: "light", ダーク: "dark" },
      defaultTheme: "ライト",
      attributeName: "data-theme",
    }),
  ],
  parameters: {
    // a11y のアドオンの違反を、Vitest で動かす story のテストの失敗にする
    a11y: { test: "error" },
    options: {
      storySort: {
        // packages/ui/DesignDoc.md の「カタログ」のページの順
        order: [
          "はじめに",
          "トークン",
          ["色", "文字", "余白と角丸と影"],
          "コンポーネント",
          ["Base", "Case"],
          "パターン",
          "画面",
        ],
      },
    },
  },
};

export default preview;
