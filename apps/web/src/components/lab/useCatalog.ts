import { useCallback, useState } from "react";
import { fetchRelations, fetchTables, type Relation, type Table } from "./catalog";
import { peekRuntime } from "./runtime";

/**
 * いま DB にあるテーブルと外部キー。
 * **自分からは起動しない。** 実行パネルが起こしたインスタンスへ相乗りする。
 * 側柱を出すためだけに WASM を落とさせない。
 */
export function useCatalog(contentId: string) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);

  const reload = useCallback(async () => {
    const rt = peekRuntime(contentId);
    if (!rt) return;
    try {
      setTables(await fetchTables(rt));
      setRelations(await fetchRelations(rt));
    } catch {
      // 一覧が出せなくても本文は読める
    }
  }, [contentId]);

  return { tables, relations, reload };
}
