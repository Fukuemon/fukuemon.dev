export interface SiteNavItem {
  label: string;
  href: string;
}

export const SITE_NAV: readonly SiteNavItem[] = [
  { label: "記事", href: "/articles" },
  { label: "プレイグラウンド", href: "/playground" },
];

/**
 * パスが、ヘッダーのナビのどの項目の配下かを返す。項目の `href` か、その下のパスなら、その `href` を返す。
 * どの項目の配下でもないパス（トップ、シリーズ、404）では `undefined` を返す。
 */
export function currentNavHref(pathname: string): string | undefined {
  return SITE_NAV.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.href;
}
