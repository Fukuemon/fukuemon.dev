import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Decorator, Preview } from "@storybook/react-vite";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons, useEffect } from "storybook/preview-api";

import "./preview.css";

const THEMES: Record<string, string> = { "OS の設定": "system", ライト: "light", ダーク: "dark" };

/**
 * withThemeByDataAttribute は story を描くときに data-theme を書くので、inline の story が無い Docs のページ
 * （story を全て iframe で描くページ）には data-theme が付かない。globals の変更を受けて、ページにも書く。
 */
function applyThemeGlobal({ globals }: { globals: Record<string, unknown> }) {
  const theme = THEMES[String(globals.theme)];
  if (theme) document.documentElement.dataset.theme = theme;
}
if (addons.hasChannel()) {
  addons.getChannel().on(SET_GLOBALS, applyThemeGlobal);
  addons.getChannel().on(GLOBALS_UPDATED, applyThemeGlobal);
}

/**
 * Docs のページに iframe で埋めた story（Canvas の inline: false）は、ツールバーのテーマを受け取らない。
 * 埋めた側のページの data-theme を写し、ツールバーで切り替えたときも追う。
 * story が自分の globals でテーマを決めているときは写さない。
 */
const followDocsTheme: Decorator = (Story, context) => {
  useEffect(() => {
    const embedder = window.frameElement?.ownerDocument;
    // manager の直下の iframe と、テストのブラウザでは、ツールバーの globals のほうに従う
    if (!embedder || window.parent === window.top || context.storyGlobals?.theme) return;
    const sync = () => {
      const theme = embedder.documentElement.dataset.theme;
      if (theme && document.documentElement.dataset.theme !== theme) {
        document.documentElement.dataset.theme = theme;
      }
    };
    sync();
    // withThemeByDataAttribute が自分の data-theme を書き戻したときも、埋めた側に合わせ直す
    const observer = new MutationObserver(sync);
    observer.observe(embedder.documentElement, { attributeFilter: ["data-theme"] });
    observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return Story();
};

const preview: Preview = {
  // ツールバーでテーマを切り替える。ダークは semantic-dark.css の [data-theme="dark"] のブロックが効く
  decorators: [
    withThemeByDataAttribute({
      // デフォルトは OS の設定に従う。data-theme が light でも dark でもないとき、semantic-dark.css の @media のブロックが効く
      themes: THEMES,
      defaultTheme: "OS の設定",
      attributeName: "data-theme",
    }),
    followDocsTheme,
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
