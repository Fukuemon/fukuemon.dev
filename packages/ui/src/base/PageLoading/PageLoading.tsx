import { useEffect, useRef } from "react";

export type PageLoadingProps = {
  /** 待っていることを表す文。印が止まっていても伝わるよう、必ず渡して画面に出す。 */
  label: string;
};

/**
 * コードを動かせるようになるまでの待ちを、画面を覆う紙の面の中央に 1 つだけ出す。文の下に、主の色の筆の線を置き、左から伸びて右へ抜ける。
 * 覆っている間は、覆いの外の要素を `inert` にし、フォーカスを覆いの外に出さない。消えたときは、覆う前にフォーカスがあった要素へ戻す。
 * 領域ごとの待ちには `Loading` を使う。文は `output` 要素に入れ、読み上げの対象にする。`output` の暗黙の role は status である。
 */
export function PageLoading({ label }: PageLoadingProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 覆いから body までの祖先ごとに、その兄弟を inert にする。覆いの外の要素を、まとめて操作できなくする
    const made: Element[] = [];
    for (
      let node: Element = root;
      node.parentElement && node !== document.body;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
    // ブラウザは inert にした要素からフォーカスを外すのを次の描画まで待つので、その間にキーの入力が届かないよう、ここで外す
    if (previous && !root.contains(previous)) previous.blur();
    return () => {
      for (const element of made) element.removeAttribute("inert");
      const current = document.activeElement;
      if (previous?.isConnected && (current === null || current === document.body))
        previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-surface-pane" ref={ref}>
      <output className="flex flex-col items-center gap-2 text-body-compact text-text">
        {label}
        <span
          aria-hidden="true"
          className="h-1.5 w-28 animate-loading bg-primary stroke-brush forced-fill-on"
        />
      </output>
    </div>
  );
}
