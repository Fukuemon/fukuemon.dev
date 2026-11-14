import { clsx } from "clsx";
import { type ReactNode, createContext, use, useId } from "react";

import { Loading } from "../../base/Loading/Loading";
import { Notice } from "../../base/Notice/Notice";

/**
 * 領域の中身の状態。loading と error の間は、中身の代わりに待ちの印か誤りの知らせを出す。
 * pending の間は、操作、帯、中身を出さずに題だけを出し、待ちの印は画面全体の `PageLoading` に任せる。画面の全ての領域が同じ処理を待つときに使う。
 * 操作と帯を出さないのは、待ちが終わって領域が描き直されたときに、そこにあったフォーカスが失われるためである。
 */
export type ToolPaneState =
  | { kind: "ready" }
  | { kind: "pending" }
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

const JoinedContext = createContext(false);

/**
 * 中に置いた ToolPane を、隙間なく並べる前提で描かせる。中の ToolPane は四方に 1px の罫を引き、左と上へ 1px ずらして隣の罫に重ねる。
 * 隣の領域と高さや幅がそろわない並びでも、領域の間の罫は 1px になる。並べ方（flex、grid）は呼ぶ側が書き、領域の間の隙間を空けない。
 */
export function ToolPaneGroup({ children }: { children: ReactNode }) {
  return <JoinedContext value>{children}</JoinedContext>;
}

/**
 * コードを動かす画面の 1 つの領域。題の帯、操作、中身を、罫で区切って縦に積む。
 * 中身の空、読み込み中、エラーの状態を、どの領域でも同じ形で出す。
 * 文字と帯は、コードを動かす画面の密度にする（題の帯 32px、題 13px、下の帯 24px と 12px。docs/adr/0062-dense-text-and-targets-in-playground.md）。
 * ToolPane は高さを指定しない。中身だけをスクロールさせるときは、親を高さの決まった縦方向の flex か grid にする。
 * スクロールさせる要素は、中身として渡す側が `min-h-0 flex-1 overflow-y-auto` を付けて用意する。
 * フォーカスできるスクロールさせる要素は、`focus-ring-frame` を付けた要素の直下に 1 つだけ置く（docs/adr/0066-inset-focus-ring-in-dense-panes.md）。
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
  const isJoined = use(JoinedContext);
  return (
    <section
      aria-labelledby={titleId}
      className={clsx(
        "flex min-h-0 min-w-0 flex-col border-border bg-surface text-text",
        "border",
        isJoined && "-mt-px -ml-px",
      )}
    >
      <div className="flex min-h-8 items-center justify-between gap-2 border-b border-border pr-1 pl-3">
        <h2 className="text-label-compact text-text" id={titleId}>
          {title}
        </h2>
        {actions !== undefined && state.kind !== "pending" && (
          <div className="flex items-center">{actions}</div>
        )}
      </div>
      {state.kind !== "pending" && toolbar}
      <div
        className={clsx(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          surface === "code" && state.kind === "ready"
            ? "bg-code-surface font-mono text-code-compact text-code-text"
            : "bg-surface",
        )}
      >
        {state.kind === "ready" && children}
        {state.kind === "empty" && (
          <p className="p-3 text-body-compact text-text-secondary">{state.message}</p>
        )}
        {state.kind === "loading" && (
          <div className="p-3">
            <Loading density="compact" label={state.label} />
          </div>
        )}
        {state.kind === "error" && (
          <div className="p-3">
            <Notice density="compact" isAlert title={state.title} tone="danger">
              {state.message}
            </Notice>
          </div>
        )}
      </div>
      {state.kind === "ready" && footer !== undefined && (
        <div className="flex min-h-6 items-center justify-between gap-4 border-t border-border px-3 text-compact text-text-secondary">
          {footer}
        </div>
      )}
    </section>
  );
}
