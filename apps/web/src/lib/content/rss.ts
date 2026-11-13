import type { ContentRef } from "@fukuemon/content-model";

type RssChannel = {
  title: string;
  description: string;
  /** BCP 47 の言語タグ */
  language: string;
  /** サイトの URL。item の link と guid は、記事の href をこの URL で絶対にしたものになる */
  site: URL;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** XML 1.0 の Char の範囲か。タブ、改行、復帰を除く制御文字と、U+FFFE と U+FFFF を外す */
function isXmlChar(code: number): boolean {
  if (code < 0x20) return code === 0x09 || code === 0x0a || code === 0x0d;
  return code !== 0xfffe && code !== 0xffff;
}

/** XML 1.0 で使えない文字があると throw する。黙って落とすと、題が変わったまま配られるためである */
function escapeXml(text: string): string {
  for (let i = 0; i < text.length; i++) {
    if (!isXmlChar(text.charCodeAt(i))) {
      throw new Error(`XML に書けない文字がある: ${JSON.stringify(text)}`);
    }
  }
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

/** RSS 2.0 の文書を返す。item は渡した順に並べる */
export function buildRss(channel: RssChannel, items: readonly ContentRef[]): string {
  const element = (name: string, text: string) => `<${name}>${escapeXml(text)}</${name}>`;
  const lines = items.map((ref) => {
    const link = new URL(ref.href, channel.site).href;
    return [
      "<item>",
      element("title", ref.title),
      element("link", link),
      `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
      element("description", ref.description),
      element("pubDate", ref.date.toUTCString()),
      "</item>",
    ].join("");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    element("title", channel.title),
    element("link", channel.site.href),
    element("description", channel.description),
    element("language", channel.language),
    ...lines,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
