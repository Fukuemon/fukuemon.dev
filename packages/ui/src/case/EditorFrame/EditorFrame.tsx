import type { ReactNode } from "react";

import { FileIcon } from "../../base/FileIcon/FileIcon";
import { type TabItem, Tabs } from "../../base/Tabs/Tabs";
import { type CodeThemeName, type VsCodeTheme, toVsCodeTheme } from "../../tokens/code-theme";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

/** 開いたファイルの 1 つ。 */
export type EditorFile = Pick<TabItem, "id" | "label">;

export type EditorFrameProps = {
  title?: string;
  files: readonly EditorFile[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** 渡すと、ファイルのタブに閉じるボタンを付ける。 */
  onClose?: (id: string) => void;
  /** 渡すと、エディタの下の帯に出す（カーソルの位置、言語）。 */
  status?: ReactNode;
  /** エンジンに渡すコードの色のテーマ。どちらにするかは呼ぶ側が決める。 */
  themeName?: CodeThemeName;
  /** 渡すと、エンジンの代わりに、待っている間の空の中身、読み込み中、エラーのどれかを出す。 */
  state?: Extract<ToolPaneState, { kind: "pending" | "loading" | "error" }>;
  /**
   * none のときは、エンジンを置く領域に最小の高さ（192px）を付けず、枠を置く側が決めた高さに合わせる。
   * 入力欄を低くして、結果の欄と縦に並べるときに使う。
   */
  minBodyHeight?: "default" | "none";
  /** 選んだファイルを開くエンジン。themeName から作った VS Code の形式のテーマを受け取る。 */
  children: (theme: VsCodeTheme, file: EditorFile) => ReactNode;
};

/**
 * ファイルのタブと、エディタのエンジンを置く枠。エンジンは持たず、コードの面の色と等幅の文字の中に children を描く。
 * CSS の変数を読めるエンジンは面の色をそのまま継ぎ、色の値を求めるエンジンは children が受け取るテーマを使う（docs/adr/0022-code-colors-from-tokens.md）。
 */
export function EditorFrame({
  title = "エディタ",
  files,
  selectedId,
  onSelect,
  onClose,
  status,
  themeName = "light",
  state,
  minBodyHeight = "default",
  children,
}: EditorFrameProps) {
  const selected = files.find((file) => file.id === selectedId) ?? files[0];
  const paneState: ToolPaneState =
    state ??
    (selected === undefined
      ? { kind: "empty", message: "ファイルを選ぶと、ここに開きます。" }
      : { kind: "ready" });
  const theme = toVsCodeTheme(themeName);

  return (
    <ToolPane footer={status} state={paneState} title={title}>
      {selected !== undefined && (
        <Tabs
          items={files.map((file) => ({
            id: file.id,
            label: file.label,
            closable: onClose !== undefined,
            icon: <FileIcon kind="file" name={file.label} />,
            content: (
              // スクロールはエンジンが持つ。枠でもスクロールさせると、スクロールバーが 2 重になる
              <div
                className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-code-surface font-mono text-code-compact text-code-text ${minBodyHeight === "none" ? "min-h-0" : "min-h-48"}`}
              >
                {file.id === selected.id && children(theme, file)}
              </div>
            ),
          }))}
          density="compact"
          label="開いたファイル"
          onClose={onClose}
          onSelect={onSelect}
          panel="flush"
          selectedId={selected.id}
        />
      )}
    </ToolPane>
  );
}
