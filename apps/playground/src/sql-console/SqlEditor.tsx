import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { type EditorStates, keepState, restoreState } from "../code-editor/editor-states";
import { codeEditorExtensions } from "../code-editor/extensions";

const STATE_KEY = "query";

export type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl か ⌘ と Enter のキーで呼ぶ。 */
  onRun: () => void;
  /** 操作の案内を書いた要素の id。 */
  describedBy?: string;
  /** 配置が替わって入力欄を作り直しても、元に戻す履歴とカーソルを残すための入れ物。 */
  states?: EditorStates;
};

/** SQL の入力欄。CodeMirror 6 を描く。value は、外から変わったときだけ入力欄に写す。 */
export function SqlEditor({ value, onChange, onRun, describedBy, states }: SqlEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const handlers = useRef({ onChange, onRun });
  // 入力欄は 1 度だけ作る。value の変化は、下の Effect で写す
  const initialValue = useRef(value);
  const initialDescribedBy = useRef(describedBy);
  const initialStates = useRef(states);

  useEffect(() => {
    handlers.current = { onChange, onRun };
  });

  useEffect(() => {
    const extensions = [
      ...codeEditorExtensions({
        label: "SQL",
        describedBy: initialDescribedBy.current,
        onRun: () => handlers.current.onRun(),
      }),
      sql(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
      }),
      keepState(initialStates.current, STATE_KEY),
    ];
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      state: restoreState(initialStates.current, STATE_KEY, initialValue.current, extensions),
    });
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}
