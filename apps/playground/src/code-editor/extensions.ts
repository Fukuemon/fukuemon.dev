import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";

// 色は packages/ui のテーマ変数を読み、ライトとダークをトークンの側で切り替える (docs/adr/0022-code-colors-from-tokens.md)
// 今いる行の帯は、コードの面より明るい surface にする。ライトとダークのどちらでも、コードの面との差が出る
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
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--color-surface)" },
  ".cm-cursor": { borderLeftColor: "var(--color-code-text)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "transparent",
    outline: "1px solid var(--color-border-field)",
  },
  // CodeMirror の既定の色はライトの固定の値なので、選択、検索、補完、フォーカスの色もテーマ変数にする
  "&.cm-focused": { outline: "2px solid var(--color-focus)", outlineOffset: "-2px" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, ::selection":
    { backgroundColor: "var(--color-info-surface)" },
  ".cm-searchMatch": {
    backgroundColor: "var(--color-warning-surface)",
    outline: "1px solid var(--color-warning)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--color-info-surface)" },
  ".cm-selectionMatch": { backgroundColor: "var(--color-surface-subtle)" },
  ".cm-panels": {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text)",
    fontSize: "var(--text-body-dense)",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--color-border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--color-border)" },
  ".cm-panel.cm-search": { fontSize: "var(--text-body-dense)" },
  ".cm-panel.cm-search label": { fontSize: "var(--text-body-dense)" },
  ".cm-textfield": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-field)",
    fontSize: "var(--text-body-dense)",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-field)",
    fontSize: "var(--text-body-dense)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--color-info-surface)",
    color: "var(--color-text)",
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--color-code-keyword)", fontWeight: "bold" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-code-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--color-code-number)" },
  { tag: tags.comment, color: "var(--color-code-comment)", fontStyle: "italic" },
  { tag: [tags.typeName, tags.standard(tags.name)], color: "var(--color-code-type)" },
  { tag: tags.function(tags.variableName), color: "var(--color-code-function)" },
]);

const guide = "var(--color-border)";

export type CodeEditorOptions = {
  /** 入力欄の読み上げる名前。 */
  label: string;
  /** Ctrl か ⌘ と Enter のキーで呼ぶ。 */
  onRun?: () => void;
};

/**
 * プレイグラウンドのツールのエディタに共通の、CodeMirror 6 の拡張。言語の拡張は、呼ぶ側が足す。
 * 行番号、今いる行の帯、字下げの補助線、対応する括弧の強調を出し、折りたたみの印は出さない。
 * Tab のキーは字下げに使わない。キーボードで入力欄の外へ移れなくなるためである。
 */
export function codeEditorExtensions({ label, onRun }: CodeEditorOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightSelectionMatches(),
    indentationMarkers({
      colors: { light: guide, dark: guide, activeLight: guide, activeDark: guide },
    }),
    syntaxHighlighting(highlight),
    theme,
    EditorView.contentAttributes.of({ "aria-label": label }),
    ...(onRun
      ? [
          // 既定の keymap は Mod-Enter で空の行を足すので、それより先に受ける
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  onRun();
                  return true;
                },
              },
            ]),
          ),
        ]
      : []),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
    ]),
  ];
}
