/**
 * メッセージを送ったページの origin から、そのページを返したポートを求める。
 * 待ち受けているポートの URL と同じ origin のものだけを返し、ほかの iframe とウィンドウからのメッセージには undefined を返す。
 */
export function portOfOrigin(
  open: ReadonlyMap<number, string>,
  origin: string,
): number | undefined {
  for (const [port, url] of open) {
    if (URL.canParse(url) && new URL(url).origin === origin) return port;
  }
  return undefined;
}
