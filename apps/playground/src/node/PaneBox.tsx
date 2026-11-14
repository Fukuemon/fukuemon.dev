import type { ReactNode } from "react";

/**
 * SplitPane の領域を、1 つのペインで埋める。ToolPane は高さを持たないので、縦の flex で広げる。
 * SplitPane の領域は外にはみ出す描画を切るので、フォーカスの輪が入る 4px の余白を取る。
 */
export function PaneBox({
  editorFocusRing = false,
  children,
}: {
  /** 中の CodeMirror にフォーカスがあるときに、ペインを輪で囲む。 */
  editorFocusRing?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="size-full p-1">
      <div
        className={`flex size-full flex-col [&>section]:flex-1 ${editorFocusRing ? "has-[.cm-focused]:focus-ring" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
