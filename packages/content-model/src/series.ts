export class NestedSeriesError extends Error {
  constructor(readonly path: string) {
    super(`シリーズのディレクトリの下に、さらにディレクトリがあります: ${path}`);
    this.name = "NestedSeriesError";
  }
}

export class MissingSeriesIndexError extends Error {
  constructor(
    readonly series: string,
    readonly paths: readonly string[],
  ) {
    super(
      `シリーズ ${series} に index.md がありません。タイトルと説明を書いてください: ${paths.join(", ")}`,
    );
    this.name = "MissingSeriesIndexError";
  }
}

export class StandaloneOrderError extends Error {
  constructor(readonly path: string) {
    super(`シリーズに入れない記事に order を書いています。消してください: ${path}`);
    this.name = "StandaloneOrderError";
  }
}

export class MissingOrderError extends Error {
  constructor(readonly path: string) {
    super(`シリーズの中の記事に order がありません: ${path}`);
    this.name = "MissingOrderError";
  }
}

export class DuplicateOrderError extends Error {
  constructor(
    readonly series: string,
    readonly order: number,
    readonly paths: readonly string[],
  ) {
    super(`シリーズ ${series} で order ${order} が重複しています: ${paths.join(", ")}`);
    this.name = "DuplicateOrderError";
  }
}

/** path は `articles/` からの相対パス (`rdbms/intro.md`、`standalone.md`) */
export type ArticleEntry = { path: string; order?: number | undefined };

export type SeriesPlan = {
  name: string;
  /** order の昇順に並べた記事の path */
  articlePaths: string[];
};

/**
 * シリーズのディレクトリの構造と order を検査し、読む順を決める。
 * シリーズに入れない記事は計画に現れない。
 * seriesIndexNames は index.md を持つシリーズのディレクトリ名。
 */
export function planSeries(
  entries: readonly ArticleEntry[],
  seriesIndexNames: ReadonlySet<string>,
): SeriesPlan[] {
  const bySeries = new Map<string, ArticleEntry[]>();

  for (const entry of entries) {
    const segments = entry.path.split("/");
    if (segments.length > 2) throw new NestedSeriesError(entry.path);
    const [first] = segments;
    if (segments.length === 1) {
      if (entry.order !== undefined) throw new StandaloneOrderError(entry.path);
      continue;
    }
    const list = bySeries.get(first as string) ?? [];
    list.push(entry);
    bySeries.set(first as string, list);
  }

  const plans: SeriesPlan[] = [];
  for (const [name, members] of bySeries) {
    if (!seriesIndexNames.has(name)) {
      throw new MissingSeriesIndexError(
        name,
        members.map((m) => m.path),
      );
    }
    const byOrder = new Map<number, string[]>();
    for (const { path, order } of members) {
      if (order === undefined) throw new MissingOrderError(path);
      byOrder.set(order, [...(byOrder.get(order) ?? []), path]);
    }
    for (const [order, paths] of byOrder) {
      if (paths.length > 1) throw new DuplicateOrderError(name, order, paths);
    }
    plans.push({
      name,
      articlePaths: [...byOrder.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, [path]]) => path as string),
    });
  }
  return plans;
}
