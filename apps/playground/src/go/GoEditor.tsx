import { go } from "@codemirror/lang-go";
import { indentUnit } from "@codemirror/language";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { codeEditorExtensions } from "../code-editor/extensions";

export type GoEditorProps = {
  /** 開くファイルのパス。ファイルを替えるときは、key を替えて作り直す。 */
  path: string;
  value: string;
  /**
   * ファイルごとの EditorState の置き場。変わるたびに書き、開くときに読む。名前の変更と削除の付け替えは、呼ぶ側が行う。
   * タブを切り替えても、元に戻す履歴とカーソルの位置が消えないようにするためである。
   */
  states: Map<string, EditorState>;
  onChange: (path: string, value: string) => void;
  /** Ctrl か ⌘ と Enter のキーで呼ぶ。 */
  onRun: () => void;
  /** カーソルが動いたときに、行と列（1 から数える）を渡す。 */
  onCursor: (line: number, column: number) => void;
  /** true のときは、開いた後にエディタにフォーカスを移す。作ったファイルを開くときに使う。 */
  focusOnOpen?: boolean;
};

/** Go のファイルのエディタ。value は、外から変わったとき（AI からの操作で書いたとき）だけ写す。 */
export function GoEditor({
  path,
  value,
  states,
  onChange,
  onRun,
  onCursor,
  focusOnOpen = false,
}: GoEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const handlers = useRef({ onChange, onRun, onCursor });
  const opened = useRef({ path, value, states, focusOnOpen });

  useEffect(() => {
    handlers.current = { onChange, onRun, onCursor };
  });

  useEffect(() => {
    const { path: file, value: doc, states: saved, focusOnOpen: focus } = opened.current;
    const reportCursor = (state: EditorState) => {
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      handlers.current.onCursor(line.number, head - line.from + 1);
    };
    const extensions = [
      ...codeEditorExtensions({ label: "Go のコード", onRun: () => handlers.current.onRun() }),
      go(),
      // gofmt と同じく、字下げをタブにする
      indentUnit.of("\t"),
      EditorState.tabSize.of(4),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) handlers.current.onChange(file, update.state.doc.toString());
        if (update.docChanged || update.selectionSet) reportCursor(update.state);
        saved.set(file, update.state);
      }),
    ];
    const kept = saved.get(file);
    // 前に開いたときの状態は、前の拡張の関数を持つので、今の拡張に付け替える。履歴とカーソルは残る
    const state = kept
      ? kept.update({ effects: StateEffect.reconfigure.of(extensions) }).state
      : EditorState.create({ doc, extensions });
    const view = new EditorView({ parent: parentRef.current ?? undefined, state });
    viewRef.current = view;
    reportCursor(view.state);
    if (focus) view.focus();
    // 外すときは書かない。名前を変えたか消したパスに、古い状態を書き戻さないためである
    return () => view.destroy();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}
