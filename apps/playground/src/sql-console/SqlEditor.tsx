import { sql } from "@codemirror/lang-sql";
import { EditorState, type Extension } from "@codemirror/state";
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
  editorStates?: EditorStates;
  /** 初期の状態に戻した回数。増えたときは、value が変わらなくても元に戻す履歴を消す。 */
  resets?: number;
};

/**
 * SQL の入力欄。CodeMirror 6 を描く。value は、外から変わったときだけ入力欄に写す。
 * 外から変わるのは、初期の状態に戻すときである。写すときと、戻した回数が増えたときは元に戻す履歴も消し、戻す前の SQL を元に戻す操作で出さない。
 */
export function SqlEditor({
  value,
  onChange,
  onRun,
  describedBy,
  editorStates,
  resets = 0,
}: SqlEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const handlers = useRef({ onChange, onRun });
  // 入力欄は 1 度だけ作る。value の変化は、下の Effect で写す
  const initialValue = useRef(value);
  const initialDescribedBy = useRef(describedBy);
  const statesRef = useRef(editorStates);
  const resetsRef = useRef(resets);
  const extensionsRef = useRef<Extension[]>([]);

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
      keepState(statesRef.current, STATE_KEY),
    ];
    extensionsRef.current = extensions;
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      state: restoreState(statesRef.current, STATE_KEY, initialValue.current, extensions),
    });
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isReset = resetsRef.current !== resets;
    resetsRef.current = resets;
    if (!isReset && view.state.doc.toString() === value) return;
    view.setState(EditorState.create({ doc: value, extensions: extensionsRef.current }));
    statesRef.current?.set(STATE_KEY, view.state);
  }, [value, resets]);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}
