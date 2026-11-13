import type { NodeRuntime } from "@fukuemon/node-runtime";

import type { EditorConnection, EditorDocument } from "../code-editor/CodeEditor";

/**
 * エディタと、実行環境の 1 つのファイルをつなぐ。開いたときにファイルを読み、コマンドがファイルを書き換えたら読み直す。
 * 最初に読めるまで、エディタは入力を受け付けない。読めないファイルは、読み取り専用のまま空で出す。
 * 返す input は、訪問者の入力のたびに呼び、ファイルに書き込む。自分が書いた中身の通知と、書き込みの途中の通知では、入力中の中身を置き換えない。
 */
export function syncFile(
  files: NodeRuntime["files"],
  path: string,
  document: EditorDocument,
): EditorConnection {
  let lastWritten: string | undefined;
  let writing = 0;
  let loaded = false;
  let closed = false;

  const load = async () => {
    // 書き込みの途中の通知は、読んでも捨てるので読まない
    if (loaded && writing > 0) return;
    const text = await files.read(path).catch((error: unknown) => {
      console.error(`${path} を読めない`, error);
      return undefined;
    });
    if (closed || text === undefined || writing > 0 || text === lastWritten) return;
    if (text !== document.read()) document.replace(text, { initial: !loaded });
    if (!loaded) {
      loaded = true;
      document.setEditable(true);
    }
  };

  void load();
  const unsubscribe = files.changes.subscribe((paths) => {
    if (paths.includes(path)) void load();
  });

  return {
    input: (text: string) => {
      lastWritten = text;
      writing++;
      void files
        .write(path, text)
        .catch((error: unknown) => console.error(`${path} に書き込めない`, error))
        .finally(() => {
          writing--;
        });
    },
    close: () => {
      closed = true;
      unsubscribe();
    },
  };
}
