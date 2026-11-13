export const SITE_NAV = [
  { label: "記事", href: "/articles" },
  { label: "プレイグラウンド", href: "/playground" },
] as const;

/**
 * ヘッダーのリンクに付ける `aria-current` の値を返す。
 * パスがリンクの `href` そのものなら `"page"`、その下のページ（記事の一覧の下の記事など）なら `"true"`、どちらでもなければ `undefined` を返す。
 * トップ（`/`）は全てのパスの上にあるが、下のページでは `"true"` にしない。ロゴがトップを指すだけで、セクションではないためである。
 */
export function ariaCurrent(pathname: string, href: string): "page" | "true" | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (path === href) return "page";
  if (href !== "/" && path.startsWith(`${href}/`)) return "true";
  return undefined;
}
