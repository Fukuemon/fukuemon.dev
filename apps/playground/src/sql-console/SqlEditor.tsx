import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { codeEditorExtensions } from "../code-editor/extensions";

export type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl か ⌘ と Enter のキーで呼ぶ。 */
  onRun: () => void;
};

/** SQL の入力欄。CodeMirror 6 を描く。value は、外から変わったときだけ入力欄に写す。 */
export function SqlEditor({ value, onChange, onRun }: SqlEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const handlers = useRef({ onChange, onRun });
  // 入力欄は 1 度だけ作る。value の変化は、下の Effect で写す
  const initialValue = useRef(value);

  useEffect(() => {
    handlers.current = { onChange, onRun };
  });

  useEffect(() => {
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      doc: initialValue.current,
      extensions: [
        ...codeEditorExtensions({ label: "SQL", onRun: () => handlers.current.onRun() }),
        sql(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
        }),
      ],
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
