import type { VsCodeTheme } from "../../tokens/code-theme";

/** カタログでエディタと端末のエンジンの代わりに置く、横に送れるコードの枠。受け取ったテーマの名前を data 属性に出す。 */
export function DummyEngine({
  label,
  theme,
  lines,
}: {
  label: string;
  theme: VsCodeTheme;
  lines: readonly string[];
}) {
  return (
    <pre
      aria-label={label}
      className="min-h-48 flex-1 overflow-auto p-4 focus-visible:focus-ring"
      data-code-theme={theme.name}
      role="region"
      tabIndex={0}
    >
      {lines.join("\n")}
    </pre>
  );
}

export const SOURCE_LINES = [
  'import { createServer } from "node:http";',
  "",
  "// 認可コードを受け取り、トークンと引き換える",
  "createServer(async (req, res) => {",
  '  const url = new URL(req.url ?? "/", "https://client.example");',
  '  const code = url.searchParams.get("code");',
  "  res.end(code === null ? 400 : 200);",
  "}).listen(3000);",
];

export const TERMINAL_LINES = [
  "$ node server.js",
  "listening on https://client.example:3000",
  "GET /callback?code=dummy-code 200",
];
