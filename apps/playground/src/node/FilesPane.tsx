import { ConfirmDialog, FileTree, Notice } from "@fukuemon/ui";
import { useState, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { childPath, nameError, projectEntries, renamedPath, toTreeNodes } from "./tree";

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

  const run = (operation: () => Promise<void>) => {
    setFailure(undefined);
    operation().catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error));
    });
  };

  /** 名前を確かめてから、新しいパスへの操作を実行する。使えない名前のときは、理由を出して実行しない。 */
  const runNamed = (name: string, path: string, operation: () => Promise<void>) => {
    const invalid = nameError(name, path, new Set(kinds.keys()));
    if (invalid !== undefined) setFailure(invalid);
    else run(operation);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 [&>section]:flex-1">
      <FileTree
        items={toTreeNodes(entries)}
        onCreate={
          files &&
          ((name, parentId) => {
            const path = childPath(parentId, name);
            runNamed(name, path, async () => {
              await files.write(path, "");
              dispatch({ type: "select-item", path, isFile: true });
            });
          })
        }
        onCreateDirectory={
          files &&
          ((name, parentId) => {
            const path = childPath(parentId, name);
            runNamed(name, path, async () => {
              await files.createDirectory(path);
              dispatch({ type: "select-item", path, isFile: false });
            });
          })
        }
        onDelete={files && setRemoving}
        onRename={
          files &&
          ((id, name) => {
            const to = renamedPath(id, name);
            if (to === id) return;
            runNamed(name, to, async () => {
              await files.rename(id, to);
              dispatch({ type: "renamed", from: id, to });
            });
          })
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
          if (path === undefined || !files) return;
          run(async () => {
            await files.remove(path);
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
