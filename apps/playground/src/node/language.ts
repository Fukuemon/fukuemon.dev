export type Language = { kind: "javascript"; jsx: boolean; typescript: boolean } | { kind: "json" };

/** ファイルの拡張子から、エディタで色を付ける言語を決める。決まらないときは undefined で、色を付けない。 */
export function languageOf(path: string): Language | undefined {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  switch (extension) {
    case "js":
    case "mjs":
    case "cjs":
      return { kind: "javascript", jsx: false, typescript: false };
    case "jsx":
      return { kind: "javascript", jsx: true, typescript: false };
    case "ts":
    case "mts":
    case "cts":
      return { kind: "javascript", jsx: false, typescript: true };
    case "tsx":
      return { kind: "javascript", jsx: true, typescript: true };
    case "json":
      return { kind: "json" };
    default:
      return undefined;
  }
}
