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
import { search, searchKeymap } from "@codemirror/search";
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
// 今いる行は選んだ行の面（surface-subtle）、選択の範囲は状態の薄い面（primary-surface）にする (packages/ui/DesignDoc.md のコードの色)
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
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--color-surface-subtle)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--color-primary-surface)" },
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-field)",
    borderRadius: "var(--radius-control)",
    boxShadow: "var(--shadow-raised)",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)" },
  ".cm-searchMatch": { backgroundColor: "var(--color-info-surface)" },
  ".cm-searchMatch-selected": { outline: "1px solid var(--color-border-field)" },
  ".cm-panels": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-panels-top": { borderBottom: "1px solid var(--color-border)" },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "8px 60px 8px 8px",
    fontSize: "var(--text-body-dense)",
  },
  ".cm-panel.cm-search br": { flexBasis: "100%", height: 0 },
  ".cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "inherit",
  },
  ".cm-panel.cm-search input[type=checkbox]": { accentColor: "var(--color-primary)", margin: 0 },
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
  // 帯の入力欄とボタンは CodeMirror が作るので、クラスを付けられない。focus-ring のユーティリティと同じ値を書く
  ".cm-textfield:focus-visible, .cm-button:focus-visible, .cm-panel.cm-search [name=close]:focus-visible, .cm-panel.cm-search input[type=checkbox]:focus-visible":
    {
      outline: "4px solid var(--fd-color-focus-outline)",
      outlineOffset: "2px",
      boxShadow: "0 0 0 2px var(--fd-color-focus-halo)",
    },
  ".cm-panel.cm-search [name=close]": {
    top: "8px",
    right: "8px",
    width: "44px",
    height: "44px",
    fontSize: "var(--text-body)",
    color: "var(--color-text)",
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

// 検索と置換の帯と、読み上げの文言
const phrases = EditorState.phrases.of({
  Find: "検索",
  Replace: "置換",
  next: "次へ",
  previous: "前へ",
  all: "すべて選ぶ",
  "match case": "大文字と小文字を区別",
  regexp: "正規表現",
  "by word": "単語で探す",
  replace: "置換",
  "replace all": "すべて置換",
  close: "閉じる",
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
 * 行番号、今いる行の帯、字下げの補助線、対応する括弧の強調を出し、折りたたみの印は出さない。
 * Tab のキーは字下げに使わない。キーボードで入力欄の外へ移れなくなるためである。
 * 検索と置換の帯は、Ctrl か ⌘ と F で上端に出す。帯の文言は日本語にし、見た目はトークンで組む。
 * フォーカスの表示は持たない。呼ぶ側が、入力欄を囲む要素に `has-[.cm-focused]:focus-ring` を付ける。
 */
export function codeEditorExtensions({ label, onRun }: CodeEditorOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSpecialChars(),
    search({ top: true }),
    phrases,
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
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
