import type { NodeRuntime } from "@fukuemon/node-runtime";

/** エディタの中身を読み書きする口。CodeMirror に依らずにテストするため、関数で受ける。 */
export type EditorDocument = {
  read: () => string;
  /** 実行環境から読んだ中身で置き換える。呼ぶ側は、この置き換えで input を呼ばない。 */
  replace: (text: string) => void;
};

/**
 * エディタと、実行環境の 1 つのファイルをつなぐ。開いたときにファイルを読み、コマンドがファイルを書き換えたら読み直す。
 * 返す input は、訪問者の入力のたびに呼び、ファイルに書き込む。自分が書いた中身の通知と、書き込みの途中の通知では、入力中の中身を置き換えない。
 */
export function syncFile(files: NodeRuntime["files"], path: string, document: EditorDocument) {
  let lastWritten: string | undefined;
  let writing = 0;
  let closed = false;

  const load = async () => {
    const text = await files.read(path).catch(() => undefined);
    if (closed || text === undefined || writing > 0 || text === lastWritten) return;
    if (text !== document.read()) document.replace(text);
  };

  const finishWrite = () => {
    writing--;
  };

  void load();
  const unsubscribe = files.changes.subscribe((paths) => {
    if (paths.includes(path)) void load();
  });

  return {
    input: (text: string) => {
      lastWritten = text;
      writing++;
      void files.write(path, text).then(finishWrite, finishWrite);
    },
    close: () => {
      closed = true;
      unsubscribe();
    },
  };
}
