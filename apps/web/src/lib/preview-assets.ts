import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NOINDEX = "/*\n  X-Robots-Tag: noindex\n";

/** `_headers` の末尾に、全てのパスへ noindex を返す規則を足す (ADR-0031) */
export function withNoindex(headers: string): string {
  if (headers.includes("X-Robots-Tag: noindex")) return headers;
  const current = headers.trimEnd();
  return current === "" ? NOINDEX : `${current}\n\n${NOINDEX}`;
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

if (import.meta.main) {
  buildPreviewAssets("dist", "dist-preview");
}
