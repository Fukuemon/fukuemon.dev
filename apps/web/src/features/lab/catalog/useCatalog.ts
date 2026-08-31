import { useCallback, useState } from "react";
import { fetchRelations, fetchTables, type Relation, type Table } from "./catalog";
import { peekRuntime } from "../runtime/runtime";

/** 実行パネルが起こしたインスタンスへ相乗りする。サイドバーのためだけに WASM を読み込ませない */
export function useCatalog(contentId: string) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);

  const reload = useCallback(async () => {
    const rt = peekRuntime(contentId);
    if (!rt) return;
    try {
      setTables(await fetchTables(rt));
      setRelations(await fetchRelations(rt));
    } catch {}
  }, [contentId]);

  return { tables, relations, reload };
}
