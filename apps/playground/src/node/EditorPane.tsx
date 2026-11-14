import { EditorFrame } from "@fukuemon/ui";
import { useId, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { FileEditor } from "./FileEditor";
import { shownFiles } from "./selection";
import { nameOf } from "./tree";

const noTree = { subscribe: () => () => undefined, getSnapshot: () => undefined };

/** エディタのペイン。開いたファイルをタブで並べ、選んだファイルを実行環境から読んで編集させる。 */
export function EditorPane() {
  const { project, runtime } = useRuntime();
  const { selection, dispatch } = useSelection();
  const tree = runtime?.files.tree ?? noTree;
  const entries = useSyncExternalStore(tree.subscribe, tree.getSnapshot);
  const { openFiles, activeFile } = shownFiles(selection, entries);
  const hintId = useId();

  return (
    <EditorFrame
      files={openFiles.map((path) => ({ id: path, label: nameOf(path) }))}
      onClose={(path) => dispatch({ type: "close-tab", path })}
      onSelect={(path) => dispatch({ type: "select-tab", path })}
      selectedId={activeFile}
      status={
        <span id={hintId}>
          {runtime ? "Tab でインデントし、Esc の後の Tab でエディタの外へ移ります" : "読み取り専用"}
        </span>
      }
    >
      {(_, file) => (
        <FileEditor
          describedBy={hintId}
          files={runtime?.files}
          initialText={
            (Object.hasOwn(project.files, file.id) ? project.files[file.id] : undefined) ?? ""
          }
          key={file.id}
          path={file.id}
        />
      )}
    </EditorFrame>
  );
}
