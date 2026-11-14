import type { Page } from "@playwright/test";

/**
 * ヘッダーの歯車の設定を、開く前に保存した状態にする。キーは `apps/web/src/components/site-settings/settings.ts` の `fd-motion` と `fd-garden`。
 * 開くたびに動くが、まだ保存していない設定だけを書く。テストの中で歯車から変えた値を、読み込み直しで戻さないためである。
 */
export const presetSettings = (
  page: Page,
  settings: { motion?: "on" | "off"; garden?: "on" | "off" },
) =>
  page.addInitScript((s) => {
    for (const [name, value] of Object.entries(s)) {
      if (localStorage.getItem(`fd-${name}`) === null) localStorage.setItem(`fd-${name}`, value);
    }
  }, settings);
