import { EditorFrame } from "@fukuemon/ui";

import { useRuntime, useSelection } from "./context";
import { FileEditor } from "./FileEditor";

const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** エディタのペイン。開いたファイルをタブで並べ、選んだファイルを実行環境から読んで編集させる。 */
export function EditorPane() {
  const { project, runtime } = useRuntime();
  const { selection, dispatch } = useSelection();
  return (
    <EditorFrame
      files={selection.openFiles.map((path) => ({ id: path, label: nameOf(path) }))}
      onClose={(path) => dispatch({ type: "close-tab", path })}
      onSelect={(path) => dispatch({ type: "select-tab", path })}
      selectedId={selection.activeFile}
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
