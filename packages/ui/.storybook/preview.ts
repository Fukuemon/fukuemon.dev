import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import "./preview.css";

const preview: Preview = {
  // ツールバーでテーマを切り替える。ダークは semantic-dark.css の [data-theme="dark"] のブロックが効く
  decorators: [
    withThemeByDataAttribute({
      // デフォルトは OS の設定に従う。data-theme が light でも dark でもないとき、semantic-dark.css の @media のブロックが効く
      themes: { "OS の設定": "system", ライト: "light", ダーク: "dark" },
      defaultTheme: "OS の設定",
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
          ["色", "文字", "余白と区切りと重なり", "コードの色"],
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
