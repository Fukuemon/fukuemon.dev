import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExpressiveCode, ExpressiveCodeTheme } from "expressive-code";
import { toHtml } from "hast-util-to-html";

import codeTheme from "./code-theme.gen.json";
import { toVsCodeTheme } from "./code-theme";

const SAMPLES = [
  {
    language: "ts",
    title: "fetch.ts",
    code: `// 認可サーバーにトークンを取りに行く
type Token = { access_token: string; expires_in: number };

export async function fetchToken(code: string): Promise<Token> {
  const res = await fetch("/oauth/token", { method: "POST", body: code });
  if (res.status !== 200) throw new Error(\`token: \${res.status}\`);
  return (await res.json()) as Token;
}`,
  },
  {
    language: "json",
    title: "response.json",
    code: `{ "access_token": "abc", "expires_in": 3600, "refresh": null, "ok": true }`,
  },
  {
    language: "bash",
    title: "",
    code: `curl -i https://example.com/api/items?page=2`,
  },
];

/** Expressive Code で、生成したコードのテーマを使ってコードブロックを描き、HTML と CSS を返す。 */
async function renderSamples() {
  const ec = new ExpressiveCode({
    themes: [
      new ExpressiveCodeTheme(toVsCodeTheme("light")),
      new ExpressiveCodeTheme(toVsCodeTheme("dark")),
    ],
  });
  const blocks = await Promise.all(
    SAMPLES.map(async (s) => {
      const { renderedGroupAst, styles } = await ec.render({
        code: s.code,
        language: s.language,
        meta: s.title ? `title="${s.title}"` : "frame=terminal",
      });
      return { html: toHtml(renderedGroupAst), styles: [...styles].join("") };
    }),
  );
  const css = [
    await ec.getBaseStyles(),
    await ec.getThemeStyles(),
    ...blocks.map((b) => b.styles),
  ].join("");
  return { css, html: blocks.map((b) => b.html).join("") };
}

/** 端末の 16 色を、コードの面の上に名前で並べる。 */
function AnsiColors({ theme }: { theme: "light" | "dark" }) {
  const ansi = codeTheme[theme].ansi;
  return (
    <ul
      className="grid grid-cols-2 gap-2 p-4 font-mono text-code-dense md:grid-cols-4"
      style={{ backgroundColor: codeTheme[theme].surface }}
    >
      {Object.entries(ansi).map(([name, color]) => (
        <li key={name} style={{ color }}>
          {name}
        </li>
      ))}
    </ul>
  );
}

/** コードの色のページ。Expressive Code の例と、端末の 16 色を並べる。 */
function CodeTokens({ css, html, theme }: { css: string; html: string; theme: "light" | "dark" }) {
  return (
    <div className="flex flex-col gap-6 bg-surface p-6 text-text">
      <style>{css}</style>
      {/* Expressive Code が描いた HTML。入力は上の SAMPLES だけで、利用者の入力を含まない */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">端末の 16 色</h2>
        <AnsiColors theme={theme} />
      </section>
    </div>
  );
}

const meta = {
  title: "トークン/コードの色",
  component: CodeTokens,
  parameters: { layout: "fullscreen" },
  loaders: [async () => renderSamples()],
  render: (args, { loaded, globals }) => (
    <CodeTokens
      {...args}
      css={loaded.css}
      html={loaded.html}
      theme={globals.theme === "ダーク" ? "dark" : args.theme}
    />
  ),
  args: { css: "", html: "", theme: "light" },
} satisfies Meta<typeof CodeTokens>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {
  name: "ライト",
  globals: { theme: "ライト" },
  args: { theme: "light" },
};

export const Dark: Story = {
  name: "ダーク",
  globals: { theme: "ダーク" },
  args: { theme: "dark" },
};
