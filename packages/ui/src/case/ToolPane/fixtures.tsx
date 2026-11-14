import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";

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

/** 行の頭の空白の数から、インデントガイドを引く段の数を出す。インデントの 1 段は 2 文字である。 */
const indentLevels = (line: string) => Math.floor((line.length - line.trimStart().length) / 2);

/** カーソルのある行の最後の `{` と、対応する `}` の位置。`{` が無ければ undefined を返す。 */
function findBracketPair(
  lines: readonly string[],
  activeLine: number,
): [[number, number], [number, number]] | undefined {
  const open = lines[activeLine]?.lastIndexOf("{") ?? -1;
  if (open < 0) return undefined;
  let depth = 0;
  for (let row = activeLine; row < lines.length; row++) {
    const line = lines[row] ?? "";
    for (let col = row === activeLine ? open : 0; col < line.length; col++) {
      if (line[col] === "{") depth++;
      if (line[col] === "}") depth--;
      if (depth === 0) {
        return [
          [activeLine, open],
          [row, col],
        ];
      }
    }
  }
  return undefined;
}

/**
 * カタログでエディタと端末のエンジンの代わりに置く、横に送れるコードの枠。受け取ったテーマの名前を data 属性に出す。
 * `source` は、プレイグラウンドの CodeMirror 6 の表示（#99）に合わせ、行番号、カーソルのある行の薄い帯、インデントガイド、対応する括弧の枠を描く。
 * 長い行を折り返さずに横に送り、行の右に 16px の余白を残す。
 */
export function DummyEngine({
  label,
  theme,
  lines,
  variant = "plain",
  activeLine = 3,
}: {
  label: string;
  theme: VsCodeTheme;
  lines: readonly string[];
  variant?: "plain" | "source";
  /** `source` で、カーソルを置いた行（0 から数える）。 */
  activeLine?: number;
}) {
  const isSource = variant === "source";
  const brackets = isSource ? findBracketPair(lines, activeLine) : undefined;
  const renderLine = (line: string, row: number) => {
    const marks = (brackets ?? []).filter(([r]) => r === row).map(([, col]) => col);
    if (marks.length === 0) return highlight(line);
    const parts: ReactNode[] = [];
    let last = 0;
    for (const col of marks) {
      parts.push(...highlight(line.slice(last, col)));
      parts.push(
        <span className="outline outline-1 outline-border-field" data-bracket key={`b${col}`}>
          {line[col]}
        </span>,
      );
      last = col + 1;
    }
    parts.push(...highlight(line.slice(last)));
    return parts;
  };
  return (
    <div className="flex min-h-48 flex-1 flex-col focus-ring-frame">
      <pre
        aria-label={label}
        className={clsx("min-h-0 flex-1 overflow-auto", isSource ? "flex py-1" : "px-3 py-2")}
        data-code-theme={theme.name}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- pre は section に替えられない。送る領域に名前を付ける role
        role="region"
        tabIndex={0}
      >
        {isSource ? (
          <>
            <span
              aria-hidden="true"
              className="sticky left-0 z-10 shrink-0 select-none bg-code-surface text-right text-code-comment"
            >
              {lines.map((_, row) => (
                <span
                  className={clsx(
                    "block pr-2 pl-4",
                    row === activeLine && "bg-surface text-code-text",
                  )}
                  // oxlint-disable-next-line react/no-array-index-key -- 行番号は並びそのもので、並びも変わらない (context/conventions.md)
                  key={row}
                >
                  {row + 1}
                </span>
              ))}
            </span>
            <code className="min-w-max flex-1">
              {lines.map((line, row) => (
                <span
                  className={clsx("relative block pr-4 pl-2", row === activeLine && "bg-surface")}
                  data-active-line={row === activeLine || undefined}
                  // oxlint-disable-next-line react/no-array-index-key -- 同じ中身の行が並ぶことがあり、並びも変わらない (context/conventions.md)
                  key={row}
                >
                  {Array.from({ length: indentLevels(line) }, (_, level) => (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 border-l border-border"
                      data-indent-guide
                      key={level}
                      // 段の位置は文字の幅で決まり、決まった段を持たないので style で渡す
                      style={{ left: `calc(0.5rem + ${level * 2}ch)` }}
                    />
                  ))}
                  {renderLine(line, row)}
                  {"\n"}
                </span>
              ))}
            </code>
          </>
        ) : (
          lines.join("\n")
        )}
      </pre>
    </div>
  );
}

const readPageColors = () => {
  const style = getComputedStyle(document.body);
  return { background: style.backgroundColor, text: style.color };
};

/**
 * カタログでプレビューの iframe に入れるダミーの中身。iframe の中はテーマの CSS の変数を継がないので、
 * 開いている画面の地の色と文字の色を読み、テーマを切り替えたときも読み直して、中身の色をテーマにそろえる。
 */
export function DummyPreview() {
  const [colors, setColors] = useState(readPageColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readPageColors()));
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  return (
    <iframe
      srcDoc={`<style>body{margin:16px;background:${colors.background};color:${colors.text};font-family:sans-serif}</style><p>ダミーのプレビュー</p>`}
      title="プレビューの画面"
    />
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
