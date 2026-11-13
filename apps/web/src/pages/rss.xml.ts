import type { APIRoute } from "astro";
import { getArticleList } from "../lib/content/articles";
import { buildRss } from "../lib/content/rss";

export const GET: APIRoute = async ({ site }) => {
  if (site === undefined) throw new Error("astro.config.ts に site が無い");
  const items = await getArticleList();
  const xml = buildRss(
    {
      title: "fukuemon.dev",
      description: "Fukuemon の技術記事を公開しています。",
      language: "ja",
      site,
    },
    items.map((i) => i.ref),
  );
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
