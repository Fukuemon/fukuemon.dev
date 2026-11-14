import { PREVIEW_CONSOLE_MESSAGE } from "./console-records";
import consoleValueSource from "./guest/console-value.cjs?raw";
import previewConsoleSource from "./guest/preview-console.cjs?raw";

/**
 * プレビューのページに入れるスクリプトを組む。toolOrigin は、記録を送る先のツールのページの origin である。
 * 2 つの guest のファイルを 1 つの関数に包み、ページのグローバルに名前を足さない。
 * `module` を引数で隠し、ページが同じ名前のグローバルを持っていても、console-value.cjs が書き込まないようにする。
 */
export function previewConsoleScript(toolOrigin: string): string {
  return [
    "(function (module, TOOL_ORIGIN, MESSAGE_TYPE) {",
    consoleValueSource,
    previewConsoleSource,
    `})(undefined, ${JSON.stringify(toolOrigin)}, ${JSON.stringify(PREVIEW_CONSOLE_MESSAGE)});`,
  ].join("\n");
}
