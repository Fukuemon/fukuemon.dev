import { clsx } from "clsx";
import { type ReactNode, useId } from "react";

import { Loading } from "../../base/Loading/Loading";
import { Notice } from "../../base/Notice/Notice";

/** 領域の中身の状態。loading と error の間は、中身の代わりに待ちの印か誤りの知らせを出す。 */
export type ToolPaneState =
  | { kind: "ready" }
  | { kind: "empty"; message: string }
  | { kind: "loading"; label: string }
  | { kind: "error"; title: string; message?: string };

export type ToolPaneProps = {
  /** 領域の題。画面に出し、領域の読み上げる名前にもする。 */
  title: string;
  /** 題の右に並べる操作。 */
  actions?: ReactNode;
  /** 題の下、中身の上に置く帯（ファイルのタブ、URL の欄）。 */
  toolbar?: ReactNode;
  /** 中身の下に置く 1 行の帯（カーソルの位置、言語）。ready のときだけ出す。 */
  footer?: ReactNode;
  state?: ToolPaneState;
  /** code はコードの面の色と等幅の文字で中身を描く。エディタと端末のエンジンを置く領域に使う。 */
  surface?: "plain" | "code";
  children?: ReactNode;
};

/**
 * コードを動かす画面の 1 つの領域。題の帯、操作、中身を、罫で区切って縦に積む。
 * 中身の空、読み込み中、エラーの状態を、どの領域でも同じ形で出す。
 * 領域は自分の高さを持たない。中身だけをスクロールさせるときは、親を高さの決まった縦方向の flex か grid にする。
 */
export function ToolPane({
  title,
  actions,
  toolbar,
  footer,
  state = { kind: "ready" },
  surface = "plain",
  children,
}: ToolPaneProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-h-0 min-w-0 flex-col border border-border bg-surface text-text"
    >
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border pl-4">
        <h2 className="text-label text-text" id={titleId}>
          {title}
        </h2>
        {actions !== undefined && <div className="flex items-center">{actions}</div>}
      </div>
      {toolbar}
      <div
        className={clsx(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          surface === "code" && state.kind === "ready"
            ? "bg-code-surface font-mono text-code text-code-text"
            : "bg-surface",
        )}
      >
        {state.kind === "ready" && children}
        {state.kind === "empty" && (
          <p className="p-4 text-body-dense text-text-secondary">{state.message}</p>
        )}
        {state.kind === "loading" && (
          <div className="p-4">
            <Loading label={state.label} />
          </div>
        )}
        {state.kind === "error" && (
          <div className="p-4">
            <Notice isAlert title={state.title} tone="danger">
              {state.message}
            </Notice>
          </div>
        )}
      </div>
      {state.kind === "ready" && footer !== undefined && (
        <div className="flex min-h-8 items-center justify-between gap-4 border-t border-border px-4 text-caption text-text-secondary">
          {footer}
        </div>
      )}
    </section>
  );
}
