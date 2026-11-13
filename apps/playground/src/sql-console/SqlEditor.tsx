import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

// 色は packages/ui のテーマ変数を読み、ライトとダークをトークンの側で切り替える (docs/adr/0022-code-colors-from-tokens.md)
const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-code-surface)",
    color: "var(--color-code-text)",
    fontSize: "var(--text-code)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "var(--text-code--line-height)" },
  ".cm-gutters": {
    backgroundColor: "var(--color-code-surface)",
    color: "var(--color-code-comment)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-cursor": { borderLeftColor: "var(--color-code-text)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--color-code-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-code-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--color-code-number)" },
  { tag: tags.comment, color: "var(--color-code-comment)" },
  { tag: [tags.typeName, tags.standard(tags.name)], color: "var(--color-code-type)" },
  { tag: tags.function(tags.variableName), color: "var(--color-code-function)" },
]);

export type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl か Cmd と Enter のキーで呼ぶ。 */
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
        basicSetup,
        sql(),
        theme,
        syntaxHighlighting(highlight),
        EditorView.contentAttributes.of({ "aria-label": "SQL" }),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                handlers.current.onRun();
                return true;
              },
            },
          ]),
        ),
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
