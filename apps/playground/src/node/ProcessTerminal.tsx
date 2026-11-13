import "@xterm/xterm/css/xterm.css";

import type { ProcessHandle } from "@fukuemon/node-runtime";
import type { VsCodeTheme } from "@fukuemon/ui";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

import { toXtermTheme } from "./terminal-theme";

/** 1 つのプロセスの端末。今までの出力を書いてから、追加の出力を書き、入力と端末の大きさをプロセスに渡す。 */
export function ProcessTerminal({ handle, theme }: { handle: ProcessHandle; theme: VsCodeTheme }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal>(null);
  // 端末は、プロセスごとに 1 度だけ作る。テーマの変化は、下の Effect で色だけを替える
  const initialTheme = useRef(theme);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: getComputedStyle(parent).fontFamily,
      fontSize: Number.parseFloat(getComputedStyle(parent).fontSize),
      theme: toXtermTheme(initialTheme.current),
    });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(parent);
    terminal.write(handle.output.read());
    const unsubscribe = handle.output.subscribe((chunk) => terminal.write(chunk));
    const input = terminal.onData((data) => handle.write(data));
    const resize = () => {
      fit.fit();
      handle.resize({ cols: terminal.cols, rows: terminal.rows });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => {
      observer.disconnect();
      input.dispose();
      unsubscribe();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [handle]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = toXtermTheme(theme);
  }, [theme]);

  return <div className="min-h-0 flex-1 overflow-hidden p-2" ref={parentRef} />;
}
