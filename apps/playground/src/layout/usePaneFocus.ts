import { useEffect, useRef, useState } from "react";

type Target = "tab" | "editor";

/**
 * 狭い配置で、タブを替えたりドロワーを閉じたりした後のフォーカスの移り先を決める。
 * 返した `rootRef` を、タブの帯とドロワーを囲む要素に付ける。
 * 移すのは、描き直してドロワーを閉じた後の Effect で、エディタへは次のフレームで移す。ドロワーの dialog は、閉じると開く前の要素へフォーカスを戻すので、その後に移す。
 */
export function usePaneFocus() {
  const rootRef = useRef<HTMLDivElement>(null);
  // 同じ移り先を続けて頼んでも Effect を流すよう、頼むたびに新しいオブジェクトにする
  const [request, setRequest] = useState<{ target: Target }>();

  useEffect(() => {
    const root = rootRef.current;
    if (request === undefined || root === null) return;
    if (request.target === "editor") {
      // 開いたファイルのエディタは、同じ描画の Effect で作り直すので、次のフレームで探す
      const frame = requestAnimationFrame(() =>
        root.querySelector<HTMLElement>(".cm-content")?.focus(),
      );
      return () => cancelAnimationFrame(frame);
    }
    // 実行のボタンのように、見えたままの要素にあるフォーカスは動かさない
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.closest("[hidden]") === null) return;
    root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [request]);

  return {
    rootRef,
    /** 隠れたペインにあったフォーカスを、帯の選んだタブへ移す。 */
    focusSelectedTab: () => setRequest({ target: "tab" }),
    /** エディタ（CodeMirror）の入力の領域へフォーカスを移す。 */
    focusEditor: () => setRequest({ target: "editor" }),
  };
}
