/**
 * コードの配色。Shiki / Expressive Code へ渡す。
 *
 * **値は tokens.css の `--c-*` と同じものである。**
 * Shiki はビルド時に色を解決するため CSS カスタムプロパティを引けない。
 * 片方を変えたらもう片方も変える。ずれは `checkCodeTheme()` が検出する。
 *
 * 輝度を単調な梯子に並べる。隣接比は明 1.27 / 暗 1.11 が最小。
 * 色の比が詰まったときの手掛かりとして、keyword に太字、comment に斜体を重ねる。
 */

export type CodePalette = {
  bg: string;
  plain: string;
  key: string;
  ident: string;
  lit: string;
  com: string;
};

export const LIGHT: CodePalette = {
  bg: "#f1eee6",
  plain: "#1a1714", // 15.39
  key: "#5e1b33", // 10.78
  ident: "#2a4470", //  8.39
  lit: "#7a4a12", //  6.43
  com: "#6a6459", //  5.06
};

export const DARK: CodePalette = {
  bg: "#211d17",
  plain: "#f4f1ea", // 14.86
  lit: "#e8c08a", //  9.85
  key: "#e48fa8", //  7.02
  com: "#938d80", //  5.08
  ident: "#5a88c4", //  4.59
};

const scopes = (p: CodePalette) => [
  {
    scope: ["comment", "punctuation.definition.comment", "string.comment", "meta.documentation"],
    settings: { foreground: p.com, fontStyle: "italic" },
  },
  {
    scope: [
      "keyword",
      "storage",
      "storage.type",
      "storage.modifier",
      "keyword.control",
      "keyword.operator.expression",
      "keyword.other",
      "variable.language",
      "constant.language",
    ],
    settings: { foreground: p.key, fontStyle: "bold" },
  },
  {
    scope: [
      "entity.name.function",
      "entity.name.type",
      "entity.name.class",
      "entity.name.tag",
      "entity.other.attribute-name",
      "support.function",
      "support.type",
      "support.class",
      "variable",
      "variable.other",
      "meta.function-call",
    ],
    settings: { foreground: p.ident },
  },
  {
    scope: [
      "string",
      "string.quoted",
      "constant.numeric",
      "constant.character",
      "constant.other",
      "punctuation.definition.string",
    ],
    settings: { foreground: p.lit },
  },
  {
    scope: ["punctuation", "meta.brace", "keyword.operator"],
    settings: { foreground: p.plain },
  },
];

const build = (name: string, type: "light" | "dark", p: CodePalette) => ({
  name,
  type,
  colors: {
    "editor.background": p.bg,
    "editor.foreground": p.plain,
  },
  tokenColors: scopes(p),
});

export const codeThemeLight = build("fukuemon-light", "light", LIGHT);
export const codeThemeDark = build("fukuemon-dark", "dark", DARK);
