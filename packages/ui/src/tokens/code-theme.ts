import codeTheme from "./code-theme.gen.json";

type CodeColors = (typeof codeTheme)["light"];

/** コードのテーマの名前。Expressive Code は名前を `[data-theme='<名前>']` のセレクタに使う。 */
export type CodeThemeName = "light" | "dark";

/** VS Code の形式のテーマ。Expressive Code と Shiki が読む。 */
export type VsCodeTheme = {
  name: CodeThemeName;
  type: CodeThemeName;
  colors: Record<string, string>;
  tokenColors: { scope: string[]; settings: { foreground: string; fontStyle?: string } }[];
};

const ANSI_KEYS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/**
 * 生成したコードの色（code-theme.gen.json）から、VS Code の形式のテーマを作る（docs/adr/0022-code-colors-from-tokens.md）。
 * コメントは斜体、キーワードは太字にし、色だけで字句の種類を分けない。
 */
export function toVsCodeTheme(name: CodeThemeName): VsCodeTheme {
  const c: CodeColors = codeTheme[name];
  const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
  const ansi = Object.fromEntries(
    ANSI_KEYS.flatMap((key) => {
      const bright = `bright${capitalize(key)}` as keyof CodeColors["ansi"];
      return [
        [`terminal.ansi${capitalize(key)}`, c.ansi[key]],
        [`terminal.ansiBright${capitalize(key)}`, c.ansi[bright]],
      ];
    }),
  );
  return {
    name,
    type: name,
    colors: {
      "editor.background": c.surface,
      "editor.foreground": c.text,
      "terminal.background": c.surface,
      "terminal.foreground": c.text,
      ...ansi,
    },
    tokenColors: [
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: c.comment, fontStyle: "italic" },
      },
      {
        scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.operator.new"],
        settings: { foreground: c.keyword, fontStyle: "bold" },
      },
      {
        scope: ["string", "string.regexp", "punctuation.definition.string"],
        settings: { foreground: c.string },
      },
      {
        scope: ["constant.numeric", "constant.language", "constant.character"],
        settings: { foreground: c.number },
      },
      {
        scope: ["entity.name.function", "support.function", "meta.function-call"],
        settings: { foreground: c.function },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "support.type",
          "support.class",
          "entity.name.tag",
          "support.type.property-name.json",
        ],
        settings: { foreground: c.type },
      },
    ],
  };
}
