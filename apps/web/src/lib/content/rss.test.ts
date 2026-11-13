import type { ContentRef } from "@fukuemon/content-model";
import { describe, expect, it } from "vitest";
import { buildRss } from "./rss";

const CHANNEL = {
  title: "fukuemon.dev",
  description: "技術の記事",
  language: "ja",
  site: new URL("https://fukuemon.dev"),
};

const ref = (href: string, over: Partial<ContentRef> = {}): ContentRef => ({
  contentId: href,
  format: "page",
  title: `題 ${href}`,
  description: `説明 ${href}`,
  href,
  tags: ["検証"],
  date: new Date("2026-11-14T00:00:00Z"),
  ...over,
});

const document = (items: string[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    "<title>fukuemon.dev</title>",
    "<link>https://fukuemon.dev/</link>",
    "<description>技術の記事</description>",
    "<language>ja</language>",
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");

const item = (path: string, title: string, description: string) =>
  `<item><title>${title}</title><link>https://fukuemon.dev${path}</link>` +
  `<guid isPermaLink="true">https://fukuemon.dev${path}</guid>` +
  `<description>${description}</description>` +
  "<pubDate>Sat, 14 Nov 2026 00:00:00 GMT</pubDate></item>";

describe("buildRss", () => {
  it("記事が無いときは、チャンネルの題、サイトの URL、説明、言語だけを書く", () => {
    expect(buildRss(CHANNEL, [])).toBe(document([]));
  });

  it("記事ごとに、絶対の URL の link と guid、説明、RFC 822 の日付を持つ item を、渡した順に書く", () => {
    expect(buildRss(CHANNEL, [ref("/articles/b"), ref("/articles/a")])).toBe(
      document([
        item("/articles/b", "題 /articles/b", "説明 /articles/b"),
        item("/articles/a", "題 /articles/a", "説明 /articles/a"),
      ]),
    );
  });

  it("題と説明の XML の特殊な文字を、実体参照にする", () => {
    const xml = buildRss(CHANNEL, [
      ref("/articles/x", { title: `<script>&"'`, description: "a < b > c" }),
    ]);
    expect(xml).toBe(
      document([item("/articles/x", "&lt;script&gt;&amp;&quot;&apos;", "a &lt; b &gt; c")]),
    );
  });

  it("説明のタブ、改行、復帰は、そのまま書く", () => {
    const xml = buildRss(CHANNEL, [ref("/articles/x", { description: "a\tb\nc\r" })]);
    expect(xml).toBe(document([item("/articles/x", "題 /articles/x", "a\tb\nc\r")]));
  });

  it.each(["\u0000", "\u000B", "\u001F", "￾", "￿"])(
    "題に XML 1.0 で使えない文字 %j があると、ビルドを失敗させる",
    (char) => {
      expect(() => buildRss(CHANNEL, [ref("/articles/x", { title: `a${char}b` })])).toThrow(
        "XML に書けない文字がある",
      );
    },
  );
});
