export type TocItem = {
  slug: string;
  text: string;
  /** その章の本文量。罫の長さに使う */
  weight: number;
};

export type Heading = { depth: number; slug: string; text: string };

const H2 = /^##\s+(?!#)/;

/**
 * h2 ごとの本文量を数える。
 * 見出し行そのものと、コードフェンスの中身は数えない。
 * コードは分量の指標として本文と釣り合わないため。
 */
export function buildToc(markdown: string, headings: readonly Heading[]): TocItem[] {
  const h2 = headings.filter((h) => h.depth === 2);
  if (h2.length === 0) return [];

  const counts = sectionSizes(markdown);
  return h2.map((h, i) => ({
    slug: h.slug,
    text: h.text,
    weight: counts[i] ?? 0,
  }));
}

function sectionSizes(markdown: string): number[] {
  const sizes: number[] = [];
  let fence = false;
  let started = false;
  let acc = 0;

  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fence = !fence;
      continue;
    }
    if (!fence && H2.test(line)) {
      if (started) sizes.push(acc);
      started = true;
      acc = 0;
      continue;
    }
    if (!started || fence) continue;
    acc += line.trim().length;
  }
  if (started) sizes.push(acc);
  return sizes;
}
