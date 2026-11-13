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

function escapeXml(text: string): string {
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
