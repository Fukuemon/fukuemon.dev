import type { ContentGraph, ContentRef } from "./types.js";

export class DuplicateContentIdError extends Error {
  constructor(readonly contentId: string) {
    super(`contentId が重複しています: ${contentId}`);
    this.name = "DuplicateContentIdError";
  }
}

export class DanglingRelatedError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`related の参照先が存在しません: ${from} -> ${to}`);
    this.name = "DanglingRelatedError";
  }
}

export type GraphInput = { ref: ContentRef; related: readonly string[] };

/**
 * contentId の一意性と related の解決を検査し、逆参照を導出する。
 * 解決できない参照は警告ではなく失敗にする。静的サイトでは
 * 「関連が表示されない」形で静かに壊れ、目視で気づけないため。
 */
export function buildContentGraph(entries: readonly GraphInput[]): ContentGraph {
  const byId = new Map<string, ContentRef>();
  for (const { ref } of entries) {
    if (byId.has(ref.contentId)) throw new DuplicateContentIdError(ref.contentId);
    byId.set(ref.contentId, ref);
  }

  const edges = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const set = edges.get(a) ?? new Set<string>();
    set.add(b);
    edges.set(a, set);
  };

  for (const { ref, related } of entries) {
    for (const to of related) {
      if (!byId.has(to)) throw new DanglingRelatedError(ref.contentId, to);
      if (to === ref.contentId) continue;
      link(ref.contentId, to);
      link(to, ref.contentId);
    }
  }

  const relatedOf = new Map<string, readonly string[]>();
  for (const [id, set] of edges) relatedOf.set(id, [...set]);
  return { byId, relatedOf };
}
