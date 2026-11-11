import type { ReactNode } from "react";

import { type CodeThemeName, type VsCodeTheme, toVsCodeTheme } from "../../tokens/code-theme";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

export type TerminalFrameProps = {
  /** 端末の題。動かしているコマンドやシェルの名前を書く。 */
  title?: string;
  /** 題の右に並べる操作（端末を消す、起動し直す）。 */
  actions?: ReactNode;
  /** エンジンに渡すコードの色のテーマ。どちらにするかは呼ぶ側が決める。 */
  themeName?: CodeThemeName;
  /** 渡すと、エンジンの代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
  /** 端末のエンジン。themeName から作った VS Code の形式のテーマを受け取り、`terminal.*` の色を使う。 */
  children: (theme: VsCodeTheme) => ReactNode;
};

/**
 * 端末の題と、端末のエンジンを置く枠。エンジンは持たず、コードの面の色と等幅の文字の中に children を描く。
 * 色の値を求めるエンジン（xterm.js など）は、children が受け取るテーマを使う（adr/0022-code-colors-from-tokens.md）。
 */
export function TerminalFrame({
  title = "端末",
  actions,
  themeName = "light",
  state,
  children,
}: TerminalFrameProps) {
  return (
    <ToolPane actions={actions} state={state ?? { kind: "ready" }} surface="code" title={title}>
      <div className="flex min-h-48 min-w-0 flex-1 flex-col overflow-hidden">
        {children(toVsCodeTheme(themeName))}
      </div>
    </ToolPane>
  );
}
