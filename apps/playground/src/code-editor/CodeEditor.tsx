import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { codeEditorExtensions } from "./extensions";

/** エディタの中身を読み書きする口。外から中身を置き換えるときに使う。 */
export type EditorDocument = {
  read: () => string;
  /** 外から読んだ中身で置き換える。この置き換えでは、input を呼ばない。 */
  replace: (text: string) => void;
};

/** エディタと、外の中身をつなぐ処理。input は訪問者の入力のたびに呼び、close はエディタを閉じるときに呼ぶ。 */
export type EditorConnection = { input: (text: string) => void; close: () => void };

export type CodeEditorProps = {
  /** 入力欄の読み上げる名前。 */
  label: string;
  initialText: string;
  /** 言語の拡張。 */
  language?: Extension[];
  readOnly?: boolean;
  /** 作ったときに 1 度だけ呼ぶ。渡さないときは、入力をどこにも渡さない。 */
  connect?: (document: EditorDocument) => EditorConnection;
};

/**
 * EditorFrame の中に置く、CodeMirror 6 のエディタ。拡張は codeEditorExtensions に、言語の拡張を足す。
 * エディタは 1 度だけ作る。開くファイルを替えるときは、呼ぶ側が key を替えて作り直す。
 */
export function CodeEditor({ label, initialText, language, readOnly, connect }: CodeEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const initial = useRef({ label, initialText, language, readOnly, connect });

  useEffect(() => {
    const { label, initialText, language = [], readOnly = false, connect } = initial.current;
    let connection: EditorConnection | undefined;
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      doc: initialText,
      extensions: [
        ...codeEditorExtensions({ label }),
        ...language,
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          // 外から読んだ中身で置き換えたときは、input を呼ばない
          if (!update.docChanged || update.transactions.some((t) => t.isUserEvent("load"))) return;
          connection?.input(update.state.doc.toString());
        }),
      ],
    });
    connection = connect?.({
      read: () => view.state.doc.toString(),
      replace: (text) =>
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          userEvent: "load",
        }),
    });
    return () => {
      connection?.close();
      view.destroy();
    };
  }, []);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}
