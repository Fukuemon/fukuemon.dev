import { clsx } from "clsx";
import type { ReactNode } from "react";

import type { VsCodeTheme } from "../../tokens/code-theme";

type TokenKind = "comment" | "keyword" | "string" | "number" | "function" | "type";

const KEYWORDS = new Set(["import", "from", "const", "async", "await", "new", "return"]);
const CONSTANTS = new Set(["null", "true", "false", "undefined"]);

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-code-comment italic",
  keyword: "text-code-keyword font-bold",
  string: "text-code-string",
  number: "text-code-number",
  function: "text-code-function",
  type: "text-code-type",
};

const TOKEN = /(\/\/.*$)|("[^"]*"|'[^']*')|(\b\d+\b)|(\b[A-Za-z_$][\w$]*\b)/g;

/** カタログのダミーのエンジンが、行を 7 種の字句の色に分ける。実際のエンジンはテーマから色を受け取る。 */
function highlight(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const [text, comment, string, number, word] = match;
    const start = match.index ?? 0;
    let kind: TokenKind | undefined;
    if (comment !== undefined) kind = "comment";
    else if (string !== undefined) kind = "string";
    else if (number !== undefined) kind = "number";
    else if (word !== undefined) {
      if (KEYWORDS.has(word)) kind = "keyword";
      else if (CONSTANTS.has(word)) kind = "number";
      else if (/^[A-Z]/.test(word)) kind = "type";
      else if (line[start + text.length] === "(") kind = "function";
    }
    if (kind === undefined) continue;
    if (start > last) parts.push(line.slice(last, start));
    parts.push(
      <span className={TOKEN_CLASS[kind]} key={start}>
        {text}
      </span>,
    );
    last = start + text.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

/**
 * カタログでエディタと端末のエンジンの代わりに置く、横に送れるコードの枠。受け取ったテーマの名前を data 属性に出す。
 * `source` は、行番号の溝と字句の色を付け、長い行を折り返さずに横に送る。行の右に 16px の余白を残す。
 */
export function DummyEngine({
  label,
  theme,
  lines,
  variant = "plain",
}: {
  label: string;
  theme: VsCodeTheme;
  lines: readonly string[];
  variant?: "plain" | "source";
}) {
  const isSource = variant === "source";
  return (
    <pre
      aria-label={label}
      className={clsx(
        "min-h-48 flex-1 overflow-auto py-4 focus-visible:focus-ring",
        isSource ? "flex" : "px-4",
      )}
      data-code-theme={theme.name}
      role="region"
      tabIndex={0}
    >
      {isSource ? (
        <>
          <span
            aria-hidden="true"
            className="sticky left-0 shrink-0 select-none border-r border-border bg-code-surface px-3 text-right text-code-comment"
          >
            {lines.map((_, index) => index + 1).join("\n")}
          </span>
          <code className="pr-4 pl-3">
            {lines.map((line, index) => (
              <span key={index}>
                {highlight(line)}
                {"\n"}
              </span>
            ))}
          </code>
        </>
      ) : (
        lines.join("\n")
      )}
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
