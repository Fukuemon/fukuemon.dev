import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useRan } from "../bus";
import { fetchColumnsByTable, fetchRows, fetchTables, type Table } from "./catalog";
import ErDiagram from "./ErDiagram";
import type { Entity } from "./er-layout";
import PeekList, { rowLabel } from "./PeekList";
import { peekRuntime } from "../runtime/runtime";
import Sheet from "./Sheet";
import TableDetail, { type Detail } from "./TableDetail";
import { useCatalog } from "./useCatalog";

const MAX_PEEK = 20;

/** ER 図を 1 列に積む幅。トークンの narrow と同じ境界 */
const NARROW = "(max-width: 720px)";

const subscribeNarrow = (on: () => void) => {
  const mq = globalThis.matchMedia?.(NARROW);
  mq?.addEventListener("change", on);
  return () => mq?.removeEventListener("change", on);
};
const isNarrow = () => globalThis.matchMedia?.(NARROW).matches ?? false;

export default function DbPeek({ contentId }: { contentId: string }) {
  const { tables, relations, reload } = useCatalog(contentId);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const [listOpen, setListOpen] = useState(true);

  const [er, setEr] = useState<Entity[] | null>(null);
  const erDialog = useRef<HTMLDialogElement>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const tableDialog = useRef<HTMLDialogElement>(null);
  const openEr = useRef(false);
  const openTable = useRef<Table | null>(null);

  /** カタログから引き直す。state の `tables` は実行直後に古い */
  const showEr = useCallback(async () => {
    openEr.current = true;
    if (!erDialog.current?.open) {
      setEr(null);
      erDialog.current?.showModal();
    }
    try {
      const rt = peekRuntime(contentId);
      if (!rt) return setEr([]);
      const [found, byTable] = [await fetchTables(rt), await fetchColumnsByTable(rt)];
      setEr(found.map((t) => ({ name: t.name, columns: byTable.get(t.name) ?? [] })));
    } catch {
      setEr([]);
    }
  }, [contentId]);

  const showTable = useCallback(
    async (t: Table) => {
      openTable.current = t;
      setTable(t);
      if (!tableDialog.current?.open) {
        setDetail(null);
        tableDialog.current?.showModal();
      }
      const empty = { columns: [], head: [], rows: [] };
      try {
        const rt = peekRuntime(contentId);
        if (!rt) return setDetail(empty);
        const columns = (await fetchColumnsByTable(rt)).get(t.name) ?? [];
        const { head, rows } = await fetchRows(rt, t.name, MAX_PEEK);
        setDetail({ columns, head, rows });
      } catch {
        setDetail(empty);
      }
    },
    [contentId],
  );

  useRan(contentId, () => {
    void reload();
    if (openEr.current) void showEr();
    const t = openTable.current;
    if (t) void showTable(t);
  });

  if (tables === null) return null;

  return (
    <>
      <PeekList
        tables={tables}
        relations={relations}
        open={listOpen}
        onToggle={() => setListOpen((v) => !v)}
        onShowEr={() => void showEr()}
        onShowTable={(t) => void showTable(t)}
      />

      <Sheet
        ref={erDialog}
        title="テーブル構成"
        meta={`${tables.length} テーブル · 外部キー ${relations.length} 本`}
        onClose={() => {
          openEr.current = false;
          setEr(null);
        }}
      >
        <div className="min-h-0 flex-auto overflow-auto">
          {er === null ? (
            <p className="mono meta">読み込み中…</p>
          ) : (
            <ErDiagram entities={er} relations={relations} cols={narrow ? 1 : 2} />
          )}
        </div>
      </Sheet>

      <Sheet
        ref={tableDialog}
        title={table?.name ?? ""}
        meta={rowLabel(table?.rows ?? -1)}
        onClose={() => {
          openTable.current = null;
          setTable(null);
        }}
      >
        {detail === null ? (
          <p className="mono meta">読み込み中…</p>
        ) : (
          <TableDetail detail={detail} limit={MAX_PEEK} />
        )}
      </Sheet>
    </>
  );
}
