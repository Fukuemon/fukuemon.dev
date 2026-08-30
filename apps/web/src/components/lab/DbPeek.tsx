import { useCallback, useRef, useState } from "react";
import { useRan } from "./bus";
import { fetchColumns, fetchRows, fetchTables, type Table } from "./catalog";
import ErDiagram, { type Entity } from "./ErDiagram";
import PeekList, { rowLabel } from "./PeekList";
import { peekRuntime } from "./runtime";
import Sheet from "./Sheet";
import TableDetail, { type Detail } from "./TableDetail";
import { useCatalog } from "./useCatalog";

type Props = { contentId: string };

const MAX_PEEK = 20;

/**
 * いま DB に入っているテーブルを側柱に出す。
 * 中身は幅が要るので `<dialog>` に出す。
 * 取得は `useCatalog` と `catalog.ts`、見せ方は `PeekList` / `TableDetail` が持つ。
 */
export default function DbPeek({ contentId }: Props) {
  const { tables, relations, reload } = useCatalog(contentId);
  const [listOpen, setListOpen] = useState(true);

  const [er, setEr] = useState<Entity[] | null>(null);
  const erDialog = useRef<HTMLDialogElement>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const tableDialog = useRef<HTMLDialogElement>(null);
  // 開いている窓。実行のたびに同じものを引き直す
  const openEr = useRef(false);
  const openTable = useRef<Table | null>(null);

  /**
   * テーブル構成。**カタログから引き直す。**
   * `tables` を見ると、実行の直後に呼ばれたとき古い一覧のまま描いてしまう
   */
  const showEr = useCallback(async () => {
    openEr.current = true;
    if (!erDialog.current?.open) {
      setEr(null);
      erDialog.current?.showModal();
    }
    const rt = peekRuntime(contentId);
    if (!rt) return setEr([]);
    const found = await fetchTables(rt);
    const out: Entity[] = [];
    for (const t of found) out.push({ name: t.name, columns: await fetchColumns(rt, t.name) });
    setEr(out);
  }, [contentId]);

  const showTable = useCallback(
    async (t: Table) => {
      openTable.current = t;
      setTable(t);
      if (!tableDialog.current?.open) {
        setDetail(null);
        tableDialog.current?.showModal();
      }
      try {
        const rt = peekRuntime(contentId);
        if (!rt) return setDetail({ columns: [], head: [], rows: [] });
        const columns = await fetchColumns(rt, t.name);
        const { head, rows } = await fetchRows(rt, t.name, MAX_PEEK);
        setDetail({ columns, head, rows });
      } catch {
        setDetail({ columns: [], head: [], rows: [] });
      }
    },
    [contentId],
  );

  useRan(contentId, () => {
    void reload();
    // 開いたままの窓は、実行のたびに中身を引き直す
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
        <div className="sheet__scroll">
          {er === null ? (
            <p className="mono meta">読み込み中…</p>
          ) : (
            <ErDiagram entities={er} relations={relations} />
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
