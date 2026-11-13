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

describe("buildRss", () => {
  it("チャンネルの題、サイトの URL、説明、言語を書く", () => {
    const xml = buildRss(CHANNEL, []);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain("<title>fukuemon.dev</title>");
    expect(xml).toContain("<link>https://fukuemon.dev/</link>");
    expect(xml).toContain("<description>技術の記事</description>");
    expect(xml).toContain("<language>ja</language>");
    expect(xml).not.toContain("<item>");
  });

  it("記事ごとに、絶対の URL の link と guid、説明、RFC 822 の日付を持つ item を、渡した順に書く", () => {
    const xml = buildRss(CHANNEL, [ref("/articles/b"), ref("/articles/a")]);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml.indexOf("/articles/b")).toBeLessThan(xml.indexOf("/articles/a"));
    expect(xml).toContain(
      "<item><title>題 /articles/b</title><link>https://fukuemon.dev/articles/b</link>" +
        '<guid isPermaLink="true">https://fukuemon.dev/articles/b</guid>' +
        "<description>説明 /articles/b</description>" +
        "<pubDate>Sat, 14 Nov 2026 00:00:00 GMT</pubDate></item>",
    );
  });

  it("題と説明の XML の特殊な文字を、実体参照にする", () => {
    const xml = buildRss(CHANNEL, [
      ref("/articles/x", { title: `<script>&"'`, description: "a < b > c" }),
    ]);
    expect(xml).toContain("<title>&lt;script&gt;&amp;&quot;&apos;</title>");
    expect(xml).toContain("<description>a &lt; b &gt; c</description>");
  });
});
