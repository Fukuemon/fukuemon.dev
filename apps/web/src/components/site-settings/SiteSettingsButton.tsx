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
          strokeLinejoin="round"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          width="24"
        >
          <path d="M10.23 5.02L9.96 2.72L14.04 2.72L13.77 5.02L15.68 5.81L17.12 4.00L20.00 6.88L18.19 8.32L18.98 10.23L21.28 9.96L21.28 14.04L18.98 13.77L18.19 15.68L20.00 17.12L17.12 20.00L15.68 18.19L13.77 18.98L14.04 21.28L9.96 21.28L10.23 18.98L8.32 18.19L6.88 20.00L4.00 17.12L5.81 15.68L5.02 13.77L2.72 14.04L2.72 9.96L5.02 10.23L5.81 8.32L4.00 6.88L6.88 4.00L8.32 5.81Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      }
      label="表示の設定"
      popoverTarget={SITE_SETTINGS_ID}
    />
  );
}
