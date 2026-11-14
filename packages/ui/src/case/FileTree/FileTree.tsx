import { clsx } from "clsx";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { ActionMenu, type ActionMenuItem } from "../../base/ActionMenu/ActionMenu";
import { FileIcon } from "../../base/FileIcon/FileIcon";
import { IconButton } from "../../base/IconButton/IconButton";
import { type TreeEditor, type TreeNode, TreeView } from "../../base/TreeView/TreeView";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

export type FileTreeProps = {
  title?: string;
  /** ファイルとディレクトリの木。children を持つ項目がディレクトリである。項目の名前は label で描き、content を使わない。 */
  items: readonly TreeNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  defaultExpandedIds?: readonly string[];
  /** 渡すと、新しいファイルのボタンを出す。parentId は、選んだディレクトリか、選んだファイルのディレクトリである。 */
  onCreate?: (name: string, parentId: string | undefined) => void;
  /** 渡すと、新しいディレクトリのボタンを出す。parentId は onCreate と同じ決め方である。 */
  onCreateDirectory?: (name: string, parentId: string | undefined) => void;
  /** 渡すと、選んだ項目の操作のメニューに、名前の変更を足す。名前を変えずに確定したときは呼ばない。 */
  onRename?: (id: string, name: string) => void;
  /** 渡すと、選んだ項目の操作のメニューに、削除を足し、木の項目の Delete のキーでも呼ぶ。確認は呼ぶ側が行う。 */
  onDelete?: (id: string) => void;
  /** 渡すと、木の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
};

type Editing =
  | { kind: "file"; parentId: string | undefined }
  | { kind: "directory"; parentId: string | undefined }
  | { kind: "rename"; node: TreeNode; parentId: string | undefined };

const FIELD_LABEL: Record<Editing["kind"], string> = {
  file: "新しいファイルの名前",
  directory: "新しいディレクトリの名前",
  rename: "新しい名前",
};

type Found = { node: TreeNode; parent: TreeNode | undefined };

const find = (nodes: readonly TreeNode[], id: string, parent?: TreeNode): Found | undefined => {
  for (const node of nodes) {
    if (node.id === id) return { node, parent };
    const found = node.children && find(node.children, id, node);
    if (found) return found;
  }
  return undefined;
};

const withIcons = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.map((node) => ({
    ...node,
    icon:
      node.icon ??
      ((isOpen) => (
        <FileIcon isOpen={isOpen} kind={node.children ? "directory" : "file"} name={node.label} />
      )),
    children: node.children && withIcons(node.children),
  }));

/** 名前の誤りの理由。誤りが無ければ undefined を返す。siblings は、同じディレクトリのほかの項目の名前である。 */
const problemOf = (name: string, siblings: readonly string[]): string | undefined => {
  if (name === "") return "名前を入れてください。";
  if (name.includes("/")) return "名前に / は使えません。";
  if (name === "." || name === "..") return ". と .. は名前に使えません。";
  if (siblings.includes(name)) return `${name} は、この場所に既にあります。`;
  return undefined;
};

type NameFieldProps = {
  label: string;
  initialValue: string;
  /** 開いたときに選ぶ範囲の終わり。始まりは 0 である。 */
  selectionEnd: number;
  siblings: readonly string[];
  onCommit: (name: string) => void;
  onCancel: () => void;
};

/**
 * 木の行の中の名前の欄。開くとフォーカスを移し、selectionEnd までを選ぶ。
 * Enter のキーで確定し、名前に誤りがあれば欄を開いたまま、欄の下に理由を出す。Esc のキーでやめる。
 * 欄からフォーカスが外れたときは、誤りの無い名前なら確定し、空か誤りがあればやめる。
 * 名前を変えずに確定したときは、やめたときと同じにする。
 */
function NameField({
  label,
  initialValue,
  selectionEnd,
  siblings,
  onCommit,
  onCancel,
}: NameFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter か Esc で終えた後に、欄が外れて blur が届いても、2 度目の確定ややめるを呼ばない
  const isDone = useRef(false);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(0, selectionEnd);
  }, [selectionEnd]);

  const finish = (name: string | undefined) => {
    if (isDone.current) return;
    isDone.current = true;
    if (name === undefined) onCancel();
    else onCommit(name);
  };

  const submit = (isBlur: boolean) => {
    const name = value.trim();
    if (name !== "" && name === initialValue) return finish(undefined);
    const problem = problemOf(name, siblings);
    if (problem === undefined) return finish(name);
    if (isBlur) return finish(undefined);
    setError(problem);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // IME の変換を確定する Enter では、名前を確定しない
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      submit(false);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(undefined);
    }
  };

  return (
    <span className="flex flex-col">
      <input
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error === undefined ? undefined : true}
        aria-label={label}
        autoComplete="off"
        className={clsx(
          "h-5 w-full min-w-0 rounded-control border bg-surface px-1 text-body-compact text-text outline-none",
          error === undefined ? "border-primary" : "border-danger",
        )}
        onBlur={() => submit(true)}
        onChange={(event) => {
          setValue(event.target.value);
          if (error !== undefined) setError(problemOf(event.target.value.trim(), siblings));
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        spellCheck={false}
        value={value}
      />
      {error !== undefined && (
        <span className="pt-0.5 text-compact text-danger" id={errorId}>
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * ファイルとディレクトリの一覧と、ファイルとディレクトリの作成、名前の変更、削除の操作。TreeView と ActionMenu を組む。
 * 作成は、題の右のボタンから、選んだディレクトリ（ファイルを選んでいるときは、そのファイルのディレクトリ）の子の先頭に、名前の欄の行を足して行う。
 * 名前の変更は、木の項目の F2 のキーか、選んだ項目の操作のメニューから、その行の名前を欄に替えて行う。ファイルは拡張子の前までを選んで始める。
 * 名前の欄の確定、やめる、誤りの表示は NameField のとおりで、欄を外した後は、フォーカスを木の項目へ戻す。
 * Delete のキーを押すと、その項目で onDelete を呼ぶ（onDelete を渡したとき）。確認のダイアログは呼ぶ側が開く。
 */
export function FileTree({
  title = "ファイル",
  items,
  selectedId,
  onSelect,
  defaultExpandedIds,
  onCreate,
  onCreateDirectory,
  onRename,
  onDelete,
  state,
}: FileTreeProps) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const selected = selectedId === undefined ? undefined : find(items, selectedId);

  const startRename = (id: string) => {
    const found = find(items, id);
    if (found) setEditing({ kind: "rename", node: found.node, parentId: found.parent?.id });
  };
  const startCreate = (kind: "file" | "directory") => {
    const parent = selected?.node.children ? selected.node : selected?.parent;
    setEditing({ kind, parentId: parent?.id });
  };

  const menuItems: ActionMenuItem[] = [];
  if (selected && onRename) {
    menuItems.push({
      id: "rename",
      label: "名前を変える",
      onSelect: () => startRename(selected.node.id),
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

  const commit = (name: string) => {
    setEditing(undefined);
    if (editing?.kind === "file") onCreate?.(name, editing.parentId);
    else if (editing?.kind === "directory") onCreateDirectory?.(name, editing.parentId);
    else if (editing?.kind === "rename") onRename?.(editing.node.id, name);
  };

  const editor = ((): TreeEditor | undefined => {
    if (editing === undefined) return undefined;
    const siblingNodes =
      editing.parentId === undefined ? items : (find(items, editing.parentId)?.node.children ?? []);
    const isRename = editing.kind === "rename";
    const initialValue = isRename ? editing.node.label : "";
    const extension = initialValue.lastIndexOf(".");
    const content = (
      <NameField
        initialValue={initialValue}
        // 名前を変える項目と、新しく作る種類が変わったら、欄を作り直して値と誤りを消す
        key={isRename ? `rename:${editing.node.id}` : `${editing.kind}:${editing.parentId ?? ""}`}
        label={FIELD_LABEL[editing.kind]}
        onCancel={() => setEditing(undefined)}
        onCommit={commit}
        selectionEnd={
          isRename && !editing.node.children && extension > 0 ? extension : initialValue.length
        }
        siblings={siblingNodes
          .filter((node) => !isRename || node.id !== editing.node.id)
          .map((node) => node.label)}
      />
    );
    if (isRename) return { kind: "rename", id: editing.node.id, content };
    const isBranch = editing.kind === "directory";
    return {
      kind: "insert",
      parentId: editing.parentId,
      isBranch,
      icon: <FileIcon kind={isBranch ? "directory" : "file"} name="" />,
      content,
    };
  })();

  // 空の木でも、最初の項目を作る欄を出すために、作っている間は木を描く
  const paneState: ToolPaneState =
    state ??
    (items.length === 0 && editing === undefined
      ? { kind: "empty", message: "ファイルがありません。" }
      : { kind: "ready" });

  return (
    <ToolPane
      actions={
        <>
          {onCreate !== undefined && (
            <IconButton
              icon={
                <svg aria-hidden="true" height="16" viewBox="0 0 20 20" width="16">
                  <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              }
              density="compact"
              label="新しいファイル"
              onClick={() => startCreate("file")}
            />
          )}
          {onCreateDirectory !== undefined && (
            <IconButton
              icon={
                <svg aria-hidden="true" height="16" viewBox="0 0 20 20" width="16">
                  <path
                    d="M2.5 5.5h5l1.5 2h8.5v8h-15zM10 9.5v4M8 11.5h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              }
              density="compact"
              label="新しいディレクトリ"
              onClick={() => startCreate("directory")}
            />
          )}
          {menuItems.length > 0 && selected && (
            <ActionMenu
              density="compact"
              items={menuItems}
              label={`${selected.node.label} の操作`}
            />
          )}
        </>
      }
      state={paneState}
      title={title}
    >
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <TreeView
          defaultExpandedIds={defaultExpandedIds}
          density="compact"
          editor={editor}
          items={withIcons(items)}
          label={title}
          onRequestDelete={onDelete}
          onRequestRename={onRename ? startRename : undefined}
          onSelect={onSelect}
          selectedId={selectedId}
          textSize="body-compact"
        />
      </div>
    </ToolPane>
  );
}
