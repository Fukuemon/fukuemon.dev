/**
 * mermaid の配色をサイトのトークンへ差し替えるための対応表。
 *
 * mermaid は色を確定した文字列でしか受け取らないので、`var(--...)` を直接渡せない。
 * 目印になる色を渡して描かせ、SVG が出てから `rehype-mermaid-theme` が置き換える。
 * これで 1 枚の SVG が明暗どちらの地でも成立する。
 */
export const MERMAID_TOKENS: Record<string, string> = {
  "#ff0001": "var(--fg)",
  "#ff0002": "var(--rule-strong)",
  "#ff0003": "var(--panel)",
  "#ff0004": "var(--now)",
  "#ff0005": "var(--fg-2)",
};

const [TEXT, LINE, FILL, ACCENT, MUTED] = Object.keys(MERMAID_TOKENS) as [
  string,
  string,
  string,
  string,
  string,
];

/** ビルド時に mermaid へ渡す設定。線画にして、色は目印だけを使う */
export const mermaidConfig = {
  theme: "base",
  themeVariables: {
    fontFamily: '"Zen Old Mincho", ui-serif, serif',
    fontSize: "15px",
    background: "transparent",
    primaryColor: FILL,
    primaryTextColor: TEXT,
    primaryBorderColor: LINE,
    secondaryColor: FILL,
    secondaryTextColor: TEXT,
    secondaryBorderColor: LINE,
    tertiaryColor: FILL,
    tertiaryTextColor: TEXT,
    tertiaryBorderColor: LINE,
    lineColor: LINE,
    textColor: TEXT,
    mainBkg: FILL,
    nodeBorder: LINE,
    clusterBkg: "transparent",
    clusterBorder: MUTED,
    edgeLabelBackground: FILL,
    labelBoxBorderColor: LINE,
    noteBkgColor: FILL,
    noteBorderColor: ACCENT,
    noteTextColor: TEXT,
    actorBkg: FILL,
    actorBorder: LINE,
    actorTextColor: TEXT,
    signalColor: LINE,
    signalTextColor: TEXT,
    sequenceNumberColor: TEXT,
  },
  flowchart: { curve: "linear", useMaxWidth: true },
};
