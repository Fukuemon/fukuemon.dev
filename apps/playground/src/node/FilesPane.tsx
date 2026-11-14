import { ConfirmDialog, FileTree, type FileTreeResult, Notice } from "@fukuemon/ui";
import { useState, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { childPath, nameErrorInRuntime, projectEntries, renamedPath, toTreeNodes } from "./tree";

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

  /**
   * 名前を、ツリーの一覧と実行環境のファイルシステムで確かめてから、新しいパスへの操作を実行し、新しいパスを返す。使えない名前のときは、実行せずに理由を返し、FileTree が欄の下に出す。
   * 保存は待たずにパスを返す。FileTree は、そのパスの項目が木に出たらフォーカスを移す。
   */
  const runNamed = async (
    files: NonNullable<typeof runtime>["files"],
    name: string,
    path: string,
    operation: () => Promise<void>,
  ): Promise<FileTreeResult> => {
    const invalid = await nameErrorInRuntime(name, path, new Set(kinds.keys()), (target) =>
      files.exists(target),
    );
    if (invalid !== undefined) return { error: invalid };
    run(operation);
    return { id: path };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 [&>section]:flex-1">
      <FileTree
        items={toTreeNodes(entries)}
        onCreate={
          files &&
          ((name, parentId) => {
            const path = childPath(parentId, name);
            return runNamed(files, name, path, async () => {
              await files.write(path, "");
              dispatch({ type: "select-item", path, isFile: true });
            });
          })
        }
        onCreateDirectory={
          files &&
          ((name, parentId) => {
            const path = childPath(parentId, name);
            return runNamed(files, name, path, async () => {
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
            if (to === id) return { id };
            return runNamed(files, name, to, async () => {
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
