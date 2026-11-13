import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { createSearchPanel } from "./search-panel";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";

// 色は packages/ui のテーマ変数を読み、ライトとダークをトークンの側で切り替える (docs/adr/0022-code-colors-from-tokens.md)
// アクティブ行は選んだ行の面（surface-subtle）、選択の範囲は状態の薄い面（primary-surface）にする (packages/ui/DesignDoc.md のコードの色)
// 補完の一覧は、トークンの文書の「重なり」の組にする。CodeMirror の既定の色を残すと、ダークで読めない
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
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
  "&.cm-focused": { outline: "none" },
  // 選択があるときは、アクティブ行のハイライトを消す。ハイライトは選択の層より上に描かれ、選択の範囲を隠すため
  ".cm-activeLine": { backgroundColor: "var(--color-surface-subtle)" },
  "&:has(.cm-selectionBackground) .cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "var(--color-surface-subtle)" },
  ".cm-specialChar": { color: "var(--color-danger)" },
  ".cm-dropCursor": { borderLeftColor: "var(--color-code-text)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--color-primary-surface)" },
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-field)",
    borderRadius: "var(--radius-control)",
    boxShadow: "var(--shadow-raised)",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", maxHeight: "264px" },
  ".cm-searchMatch": { backgroundColor: "var(--color-info-surface)" },
  ".cm-searchMatch-selected": { outline: "2px solid var(--color-primary)" },
  ".cm-panels": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-panels-top": { borderBottom: "1px solid var(--color-border)" },
  ".cm-search": { padding: "8px", fontSize: "var(--text-body-dense)" },
  ".cm-search-row": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" },
  ".cm-search-row + .cm-search-row": { marginTop: "8px" },
  ".cm-search-row .cm-textfield": { flex: "1 1 8rem", minWidth: 0 },
  ".cm-button[aria-pressed=true]": {
    backgroundColor: "var(--color-primary-surface)",
    color: "var(--color-text)",
  },
  ".cm-textfield": {
    minHeight: "44px",
    margin: 0,
    padding: "0 8px",
    fontSize: "inherit",
    fontFamily: "var(--font-mono)",
    color: "var(--color-text)",
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border-field)",
    borderRadius: "var(--radius-control)",
  },
  ".cm-button": {
    minHeight: "44px",
    margin: 0,
    padding: "0 12px",
    fontSize: "inherit",
    fontFamily: "inherit",
    color: "var(--color-primary)",
    backgroundColor: "var(--color-surface)",
    backgroundImage: "none",
    border: "1px solid var(--color-border-field)",
    borderRadius: "var(--radius-control)",
  },
  // パネルの入力欄とボタンは CodeMirror の DOM の中にあるので、クラスを付けられない。focus-ring のユーティリティと同じ値を書く。packages/ui/src/tokens/theme.css の focus-ring を変えたら、ここも直す
  ".cm-textfield:focus-visible, .cm-button:focus-visible": {
    outline: "2px solid var(--fd-color-focus)",
    outlineOffset: "2px",
  },
  ".cm-button:active": { backgroundImage: "none", backgroundColor: "var(--color-surface-subtle)" },
  // CodeMirror の既定は、閉じるボタンを右上に重ねる。ほかのボタンと同じ並びに戻す
  ".cm-panel.cm-search [name=close]": { position: "static", color: "var(--color-text)" },
  ".cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    minHeight: "44px",
    padding: "0 12px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-primary-surface)",
    color: "var(--color-text)",
  },
  ".cm-cursor": { borderLeftColor: "var(--color-code-text)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "transparent",
    outline: "1px solid var(--color-border-field)",
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

// 置換と行への移動の読み上げ、行へ移動のパネルの文言
const phrases = EditorState.phrases.of({
  "current match": "今の一致",
  "on line": "行",
  "replaced match on line $": "$ 行目の一致を置換しました",
  "replaced $ matches": "$ 個の一致を置換しました",
  "Go to line": "行へ移動",
  go: "移動",
});

export type CodeEditorOptions = {
  /** 入力欄の読み上げる名前。 */
  label: string;
  /** Ctrl か ⌘ と Enter のキーで呼ぶ。 */
  onRun?: () => void;
};

/**
 * プレイグラウンドのツールのエディタに共通の、CodeMirror 6 の拡張。言語の拡張は、呼ぶ側が足す。
 * 行番号、アクティブ行のハイライト、インデントガイド、対応する括弧のハイライトを出し、折りたたみのガターは出さない。
 * Tab キーでインデントする。Esc の後 2 秒の間の Tab で、エディタの外へ移る（CodeMirror の tab focus mode）。
 * 検索と置換のパネルは、Ctrl か ⌘ と F で上端に出す。パネルは search-panel.ts が組む。
 * フォーカスの表示は持たない。呼ぶ側が、入力欄を囲む要素に `has-[.cm-focused]:focus-ring` を付ける。
 */
export function codeEditorExtensions({ label, onRun }: CodeEditorOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSpecialChars(),
    search({ top: true, createPanel: createSearchPanel }),
    phrases,
    history(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ icons: false }),
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
      // 補完の一覧が開いているときは、Tab で確定する。閉じているときは、Tab でインデントする
      { key: "Tab", run: acceptCompletion },
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
    ]),
  ];
}
