import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALL_PATHS = "/*";
const NOINDEX = "  X-Robots-Tag: noindex";

/**
 * `_headers` の全てのパスの規則に、noindex を足す (ADR-0031)。
 * 同じパスの規則が 2 つあると、Workers Static Assets は後の規則のヘッダだけを返すので、既にある `/*` の規則に 1 行足す。
 * `/*` の規則が無いときだけ先頭に作り、2 つ以上あるときは、noindex が返らないので失敗する
 */
export function withNoindex(headers: string): string {
  const lines = headers.trimEnd().split(/\r?\n/);
  const rules = lines.flatMap((line, i) => (line.trim() === ALL_PATHS ? [i] : []));
  if (rules.length > 1) {
    throw new Error(
      `_headers に ${ALL_PATHS} の規則が ${rules.length} つあります。1 つにまとめてください`,
    );
  }
  const [at] = rules;
  if (at === undefined) {
    const rest = headers.trim();
    return rest === "" ? `${ALL_PATHS}\n${NOINDEX}\n` : `${ALL_PATHS}\n${NOINDEX}\n\n${rest}\n`;
  }
  lines.splice(at + 1, 0, NOINDEX);
  return `${lines.join("\n")}\n`;
}

/** ビルドの出力を複製し、複製の `_headers` に noindex を足す。ビルドの出力は変えない */
export function buildPreviewAssets(distDir: string, outDir: string): void {
  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error(`${distDir} にビルドの出力がありません。先に build を実行してください`);
  }
  rmSync(outDir, { recursive: true, force: true });
  cpSync(distDir, outDir, { recursive: true });
  const headersPath = join(outDir, "_headers");
  const current = existsSync(headersPath) ? readFileSync(headersPath, "utf8") : "";
  writeFileSync(headersPath, withNoindex(current));
}
