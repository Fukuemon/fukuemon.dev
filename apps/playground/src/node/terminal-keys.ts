type KeyInput = Pick<KeyboardEvent, "code" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

const isMac = /Mac/.test(globalThis.navigator?.platform ?? "");

/**
 * 端末の Tab で、フォーカスを移すかシェルに送るかを切り替えるキーかを返す。
 * CodeMirror と VS Code と同じく、Ctrl+M、Mac では Shift+Alt+M にする。
 */
export function isTabFocusToggle(event: KeyInput, mac = isMac): boolean {
  if (event.code !== "KeyM" || event.metaKey) return false;
  return mac
    ? event.shiftKey && event.altKey && !event.ctrlKey
    : event.ctrlKey && !event.shiftKey && !event.altKey;
}
