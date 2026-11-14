import { IconButton } from "@fukuemon/ui";
import { SITE_SETTINGS_ID } from "./settings";

/** ヘッダーの歯車のボタン。`client:*` を付けずに静的な HTML に描き、popover の `popovertarget` で設定の面を開く */
export function SiteSettingsButton() {
  return (
    <IconButton
      data-testid="site-settings-open"
      icon={
        <svg
          aria-hidden="true"
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.75"
          viewBox="0 0 24 24"
          width="24"
        >
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.46 5.46l1.77 1.77M16.77 16.77l1.77 1.77M5.46 18.54l1.77-1.77M16.77 7.23l1.77-1.77" />
        </svg>
      }
      label="表示の設定"
      popoverTarget={SITE_SETTINGS_ID}
    />
  );
}
