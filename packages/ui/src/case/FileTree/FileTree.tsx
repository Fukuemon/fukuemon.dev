import { type FormEvent, type KeyboardEvent, useState } from "react";

import { ActionMenu, type ActionMenuItem } from "../../base/ActionMenu/ActionMenu";
import { Button } from "../../base/Button/Button";
import { IconButton } from "../../base/IconButton/IconButton";
import { TextField } from "../../base/TextField/TextField";
import { type TreeNode, TreeView } from "../../base/TreeView/TreeView";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

export type FileTreeProps = {
  title?: string;
  /** ファイルとディレクトリの木。children を持つ項目がディレクトリである。 */
  items: readonly TreeNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  defaultExpandedIds?: readonly string[];
  /** 渡すと、新しいファイルのボタンを出す。parentId は、選んだディレクトリか、選んだファイルのディレクトリである。 */
  onCreate?: (name: string, parentId: string | undefined) => void;
  /** 渡すと、選んだ項目の操作のメニューに、名前の変更を足す。 */
  onRename?: (id: string, name: string) => void;
  /** 渡すと、選んだ項目の操作のメニューに、削除を足す。確認は呼ぶ側が行う。 */
  onDelete?: (id: string) => void;
  /** 渡すと、木の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
};

type Editing = { kind: "create" } | { kind: "rename"; node: TreeNode };

type Found = { node: TreeNode; parent: TreeNode | undefined };

const find = (nodes: readonly TreeNode[], id: string, parent?: TreeNode): Found | undefined => {
  for (const node of nodes) {
    if (node.id === id) return { node, parent };
    const found = node.children && find(node.children, id, node);
    if (found) return found;
  }
  return undefined;
};

/**
 * ファイルとディレクトリの一覧と、作成、名前の変更、削除の操作。TreeView、ActionMenu、TextField を組む。
 * 操作は、題の右のボタンとメニューから、選んだ項目に対して行う。木の行の中に操作を置かないのは、treeitem の中に押せるものを入れられないためである。
 * 名前の欄は Enter のキーで確定し、Esc のキーでやめる。
 */
export function FileTree({
  title = "ファイル",
  items,
  selectedId,
  onSelect,
  defaultExpandedIds,
  onCreate,
  onRename,
  onDelete,
  state,
}: FileTreeProps) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const selected = selectedId === undefined ? undefined : find(items, selectedId);

  const menuItems: ActionMenuItem[] = [];
  if (selected && onRename) {
    menuItems.push({
      id: "rename",
      label: "名前を変える",
      onSelect: () => setEditing({ kind: "rename", node: selected.node }),
    });
  }
  if (selected && onDelete) {
    menuItems.push({
      id: "delete",
      label: "削除",
      isDanger: true,
      onSelect: () => onDelete(selected.node.id),
    });
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("name");
    const name = typeof value === "string" ? value.trim() : "";
    if (name === "" || editing === undefined) return;
    if (editing.kind === "create") {
      const parent = selected?.node.children ? selected.node : selected?.parent;
      onCreate?.(name, parent?.id);
    } else {
      onRename?.(editing.node.id, name);
    }
    setEditing(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setEditing(undefined);
  };

  const paneState: ToolPaneState =
    state ??
    (items.length === 0 ? { kind: "empty", message: "ファイルがありません。" } : { kind: "ready" });

  return (
    <ToolPane
      actions={
        <>
          {onCreate !== undefined && (
            <IconButton
              icon={
                <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
                  <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              }
              label="新しいファイル"
              onClick={() => setEditing({ kind: "create" })}
            />
          )}
          {menuItems.length > 0 && selected && (
            <ActionMenu items={menuItems} label={`${selected.node.label} の操作`} />
          )}
        </>
      }
      state={paneState}
      title={title}
      toolbar={
        editing && (
          <form
            className="flex items-end gap-2 border-b border-border p-2"
            key={editing.kind === "rename" ? editing.node.id : "create"}
            onSubmit={handleSubmit}
          >
            <div className="min-w-0 flex-1">
              <TextField
                // 欄は、ボタンかメニューで開いた直後に入力するためのものなので、開いたときにフォーカスを移す
                autoFocus
                defaultValue={editing.kind === "rename" ? editing.node.label : ""}
                label={editing.kind === "rename" ? "新しい名前" : "新しいファイルの名前"}
                name="name"
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button type="submit" variant="secondary">
              {editing.kind === "rename" ? "変える" : "作る"}
            </Button>
          </form>
        )
      }
    >
      <div className="py-1">
        <TreeView
          defaultExpandedIds={defaultExpandedIds}
          items={items}
          label={title}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      </div>
    </ToolPane>
  );
}
