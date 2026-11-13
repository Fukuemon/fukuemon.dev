import { EditorFrame } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { FileEditor } from "./FileEditor";
import { nameOf } from "./tree";

const noTree = { subscribe: () => () => undefined, getSnapshot: () => undefined };

/**
 * エディタのペイン。開いたファイルをタブで並べ、選んだファイルを実行環境から読んで編集させる。
 * 端末のコマンドが消したか名前を変えたファイルのタブは、ツリーから無くなった時点で出さない。
 */
export function EditorPane() {
  const { project, runtime } = useRuntime();
  const { selection, dispatch } = useSelection();
  const tree = runtime?.files.tree ?? noTree;
  const entries = useSyncExternalStore(tree.subscribe, tree.getSnapshot);
  const existing = entries && new Set(entries.map((entry) => entry.path));
  const openFiles = selection.openFiles.filter((path) => existing?.has(path) ?? true);
  const activeFile = openFiles.includes(selection.activeFile ?? "")
    ? selection.activeFile
    : openFiles[0];

  return (
    <EditorFrame
      files={openFiles.map((path) => ({ id: path, label: nameOf(path) }))}
      onClose={(path) => dispatch({ type: "close-tab", path })}
      onSelect={(path) => dispatch({ type: "select-tab", path })}
      selectedId={activeFile}
      status={runtime ? undefined : "読み取り専用"}
    >
      {(_, file) => (
        <FileEditor
          files={runtime?.files}
          initialText={project.files[file.id] ?? ""}
          key={file.id}
          path={file.id}
        />
      )}
    </EditorFrame>
  );
}
