import type { CodeThemeName, VsCodeTheme } from "@fukuemon/ui";
import type { ITheme } from "@xterm/xterm";

const ANSI = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"] as const;

/** VS Code の形式のテーマから、xterm.js のテーマを作る。xterm.js は CSS の変数を読まないので、色の値で渡す (docs/adr/0022-code-colors-from-tokens.md)。 */
export function toXtermTheme(theme: VsCodeTheme): ITheme {
  const c = theme.colors;
  const result: Record<string, string | undefined> = {
    background: c["terminal.background"],
    foreground: c["terminal.foreground"],
    cursor: c["terminal.foreground"],
  };
  for (const name of ANSI) {
    result[name.toLowerCase()] = c[`terminal.ansi${name}`];
    result[`bright${name}`] = c[`terminal.ansiBright${name}`];
  }
  return result;
}

const DARK = "(prefers-color-scheme: dark)";

/** OS の設定の、ライトとダーク。useSyncExternalStore で読む。 */
export const colorScheme = {
  subscribe: (onChange: () => void) => {
    const query = globalThis.matchMedia?.(DARK);
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
  },
  getSnapshot: (): CodeThemeName => (globalThis.matchMedia?.(DARK).matches ? "dark" : "light"),
};
