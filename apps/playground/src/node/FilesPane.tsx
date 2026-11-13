import type { NodeRuntime } from "@fukuemon/node-runtime";
import { ConfirmDialog, FileTree, Notice } from "@fukuemon/ui";
import { useState, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { childPath, projectEntries, renamedPath, toTreeNodes } from "./tree";

const noTree = { subscribe: () => () => undefined, getSnapshot: () => undefined };

/** ファイルのツリーのペイン。実行環境のファイルの一覧を読み、作成、名前の変更、削除を実行環境に渡す。 */
export function FilesPane() {
  const { project, runtime } = useRuntime();
  const { selection, dispatch } = useSelection();
  const tree = runtime?.files.tree ?? noTree;
  const live = useSyncExternalStore(tree.subscribe, tree.getSnapshot);
  const entries = live ?? projectEntries(project.files);
  const [removing, setRemoving] = useState<string>();
  const [failure, setFailure] = useState<string>();

  const kinds = new Map(entries.map((entry) => [entry.path, entry.kind]));
  const files = runtime?.files;
  const run = (operation: (f: NodeRuntime["files"]) => Promise<void>) => {
    if (!files) return;
    setFailure(undefined);
    operation(files).catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error));
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 [&>section]:flex-1">
      <FileTree
        items={toTreeNodes(entries)}
        onCreate={
          files &&
          ((name, parentId) =>
            run(async (f) => {
              const path = childPath(parentId, name);
              await f.write(path, "");
              dispatch({ type: "select-item", path, isFile: true });
            }))
        }
        onCreateDirectory={
          files &&
          ((name, parentId) =>
            run(async (f) => {
              const path = childPath(parentId, name);
              await f.createDirectory(path);
              dispatch({ type: "select-item", path, isFile: false });
            }))
        }
        onDelete={files && setRemoving}
        onRename={
          files &&
          ((id, name) =>
            run(async (f) => {
              const to = renamedPath(id, name);
              await f.rename(id, to);
              dispatch({ type: "renamed", from: id, to });
            }))
        }
        onSelect={(path) =>
          dispatch({ type: "select-item", path, isFile: kinds.get(path) === "file" })
        }
        selectedId={selection.treeItem}
      />
      {failure !== undefined && (
        <Notice isAlert title="ファイルを操作できませんでした" tone="danger">
          {failure}
        </Notice>
      )}
      <ConfirmDialog
        confirmLabel="削除する"
        isOpen={removing !== undefined}
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          const path = removing;
          setRemoving(undefined);
          if (path === undefined) return;
          run(async (f) => {
            await f.remove(path);
            dispatch({ type: "removed", path });
          });
        }}
        title={`${removing ?? ""} を削除しますか`}
      >
        {kinds.get(removing ?? "") === "directory"
          ? "ディレクトリと、その中のファイルを全て削除します。削除したファイルは戻せません。"
          : "削除したファイルは戻せません。"}
      </ConfirmDialog>
    </div>
  );
}
