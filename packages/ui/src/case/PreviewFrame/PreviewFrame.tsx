import type { ReactNode } from "react";

import { IconButton } from "../../base/IconButton/IconButton";
import { TextField } from "../../base/TextField/TextField";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

export type PreviewFrameProps = {
  title?: string;
  /** プレビューが開いている URL。欄に出し、書き換えさせない。 */
  url: string;
  /** 渡すと、再読み込みのボタンを出す。 */
  onReload?: () => void;
  /** 渡すと、iframe の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
  /** プレビューの iframe。`title` を付けて渡す。 */
  children: ReactNode;
};

/**
 * プレビューの URL の欄と、iframe を置く枠。
 * iframe は呼ぶ側が作る。sandbox の属性と、cross-origin isolation の下で読めるかは、プレビューを出す実行環境ごとに違うためである（apps/web/src/features/lab/DesignDoc.md）。
 */
export function PreviewFrame({
  title = "プレビュー",
  url,
  onReload,
  state,
  children,
}: PreviewFrameProps) {
  return (
    <ToolPane
      state={state ?? { kind: "ready" }}
      title={title}
      toolbar={
        <div className="flex items-end gap-2 border-b border-border p-2">
          <div className="min-w-0 flex-1">
            <TextField isLabelHidden label="プレビューの URL" readOnly value={url} />
          </div>
          {onReload !== undefined && (
            <IconButton
              icon={
                <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
                  <path
                    d="M16 10a6 6 0 1 1-2-4.5M16 3v4h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              }
              label="再読み込み"
              onClick={onReload}
            />
          )}
        </div>
      }
    >
      <div className="flex min-h-48 min-w-0 flex-1 flex-col *:min-h-48 *:w-full *:flex-1">
        {children}
      </div>
    </ToolPane>
  );
}
