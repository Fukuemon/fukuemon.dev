import type { Locator, Page } from "@playwright/test";

/** OGP の meta。property は og:title のような名前、twitter:card は name で持つ */
export const ogMeta = (page: Page, property: string): Locator =>
  page.locator(`head meta[property="${property}"], head meta[name="${property}"]`);
