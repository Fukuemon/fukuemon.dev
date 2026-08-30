/**
 * mermaid の配色をサイトのトークンへ差し替えるための対応表。
 *
 * mermaid は色を確定した文字列でしか受け取らないので、`var(--...)` を直接渡せない。
 * 目印になる色を渡して描かせ、SVG が出てから `rehype-mermaid-theme` が置き換える。
 * これで 1 枚の SVG が明暗どちらの地でも成立する。
 */
export const MERMAID_TOKENS: Record<string, string> = {
  "#ff0001": "var(--color-fg)",
  "#ff0002": "var(--color-rule-strong)",
  "#ff0003": "var(--color-panel)",
  "#ff0004": "var(--color-now)",
  "#ff0005": "var(--color-fg-2)",
};

const [TEXT, LINE, FILL, ACCENT, MUTED] = Object.keys(MERMAID_TOKENS) as [
  string,
  string,
  string,
  string,
  string,
];

/**
 * ビルド時に mermaid へ渡す設定。線画にして、色は目印だけを使う。
 *
 * **書体をサイトのものに合わせない。** mermaid は箱の大きさを描画時に測って焼き込む。
 * ビルドの headless chromium に本文の書体は入っていないので、別の書体で測った箱に
 * 本文の書体を流し込むことになり、文字が箱からはみ出して切れる。
 * 環境をまたいで字幅の揃う総称に固定し、表示側でも上書きしない。
 */
export const mermaidConfig = {
  theme: "base",
  themeVariables: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "14px",
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
  // SVG の text で描く。foreignObject は測った幅で切るので、ずれると文字が消える
  htmlLabels: false,
  flowchart: { curve: "linear", useMaxWidth: true, htmlLabels: false },
};
