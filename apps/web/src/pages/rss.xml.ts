import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { listContent } from "../lib/content";
import { KIND_LABEL } from "../lib/format";

export async function GET(context: APIContext) {
  const items = await listContent();
  return rss({
    title: "fukuemon.dev",
    description: "Fukuemon の技術記事と、手を動かして進めるハンズオンを公開しています。",
    site: context.site ?? "https://fukuemon.dev",
    items: items.map((r) => ({
      title: r.title,
      description: r.description,
      link: r.href,
      pubDate: r.date,
      categories: [KIND_LABEL[r.type], ...r.tags],
    })),
  });
}
