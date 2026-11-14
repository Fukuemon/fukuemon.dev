import { Compartment, EditorState, type Extension, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { use, useEffect, useRef } from "react";

import { EditorStatesContext, keepState, restoreState } from "./editor-states";
import { codeEditorExtensions } from "./extensions";

/** エディタの中身を読み書きする口。外から中身を置き換えるときに使う。 */
export type EditorDocument = {
  read: () => string;
  /**
   * 外から読んだ中身で置き換える。この置き換えでは、input を呼ばない。
   * initial を true にすると、元に戻す履歴に入れない。開いた直後に元に戻すと、空の中身が書き戻るためである。
   */
  replace: (text: string, options?: { initial?: boolean }) => void;
  /** 入力を受け付けるかを切り替える。 */
  setEditable: (editable: boolean) => void;
};

/** エディタと、外の中身をつなぐ処理。input は訪問者の入力のたびに呼び、close はエディタを閉じるときに呼ぶ。 */
export type EditorConnection = { input: (text: string) => void; close: () => void };

type CodeEditorProps = {
  /** 入力欄の読み上げる名前。 */
  label: string;
  /** 入力欄の操作の案内を書いた要素の id。読み上げで、入力欄に入ったときに伝える。 */
  describedBy?: string;
  initialText: string;
  /** codeEditorExtensions に足す拡張。言語の拡張と、ページに固有の keymap を渡す。 */
  extensions?: Extension[];
  /**
   * 作ったときに 1 度だけ呼ぶ。渡すと、エディタは読み取り専用で始まり、setEditable で入力を受け付ける。
   * 渡さないときは、initialText を読み取り専用で出す。
   */
  connect?: (document: EditorDocument) => EditorConnection;
  /** EditorStatesContext の入れ物に状態を保つときの名前。ファイルのパスを渡す。 */
  stateKey?: string;
};

/**
 * EditorFrame の中に置く、CodeMirror 6 のエディタ。拡張は codeEditorExtensions に、extensions を足す。
 * エディタは 1 度だけ作る。開くファイルを替えるときは、呼ぶ側が key を替えて作り直す。
 * フォーカスの表示は持たない。呼ぶ側が、切られない祖先に `has-[.cm-focused]:focus-ring` を付ける。
 */
export function CodeEditor({
  label,
  describedBy,
  initialText,
  extensions,
  connect,
  stateKey,
}: CodeEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const saved = use(EditorStatesContext);
  const initial = useRef({ label, describedBy, initialText, extensions, connect, stateKey, saved });

  useEffect(() => {
    const {
      label,
      describedBy,
      initialText,
      extensions = [],
      connect,
      stateKey,
      saved,
    } = initial.current;
    const editable = new Compartment();
    let connection: EditorConnection | undefined;
    const editorExtensions = [
      ...codeEditorExtensions({ label, describedBy }),
      ...extensions,
      editable.of(EditorState.readOnly.of(true)),
      EditorView.updateListener.of((update) => {
        // 外から読んだ中身で置き換えたときは、input を呼ばない
        if (!update.docChanged || update.transactions.some((t) => t.isUserEvent("load"))) return;
        connection?.input(update.state.doc.toString());
      }),
      ...(stateKey === undefined ? [] : [keepState(saved, stateKey)]),
    ];
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      state:
        stateKey === undefined
          ? EditorState.create({ doc: initialText, extensions: editorExtensions })
          : restoreState(saved, stateKey, initialText, editorExtensions),
    });
    connection = connect?.({
      read: () => view.state.doc.toString(),
      replace: (text, options = {}) => {
        // 同じ中身で置き換えると、カーソルが先頭へ動くので、置き換えない
        if (view.state.doc.toString() === text) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          userEvent: "load",
          annotations: options.initial ? Transaction.addToHistory.of(false) : [],
        });
      },
      setEditable: (value) =>
        view.dispatch({ effects: editable.reconfigure(EditorState.readOnly.of(!value)) }),
    });
    return () => {
      connection?.close();
      view.destroy();
    };
  }, []);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}
