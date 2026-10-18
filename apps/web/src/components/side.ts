/**
 * 開閉を `btn` の属する版面 `.g-doc` に当て、当てた状態を返す。
 * `open` を渡さないときは、保存した状態か、無ければ画面の幅から決める。
 *
 * `Side.astro` がこの関数を文字列にして、開閉ボタンの直後の inline script に埋め込む。
 * 面が描かれる前に状態が決まるので、読み込み直後に面が滑らない。
 * 文字列にして運ぶので、この関数の外の名前を参照しない。
 */
export function applySide(btn: HTMLElement, open?: boolean): boolean {
  if (open === undefined) {
    // CSS の折り返しと同じ問いにする。1101px と書くと 1100.5px で両方が偽になる
    open = !(globalThis.matchMedia?.("(max-width: 1100px)").matches ?? false);
    try {
      const saved = globalThis.localStorage?.getItem(`side:${btn.dataset.side ?? ""}`);
      if (saved) open = saved === "open";
    } catch {}
  }
  const root = btn.closest<HTMLElement>(".g-doc");
  if (root) root.dataset.open = String(open);
  btn.setAttribute("aria-expanded", String(open));
  btn.title = open ? "たたむ" : "ひらく";
  return open;
}

/** サイドバーの開閉を `root` に取り付ける。状態は `localStorage` に置く */
export function mountSide(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>("[data-side]");
  if (!btn) return;

  let open = applySide(btn);

  const set = (next: boolean) => {
    open = applySide(btn, next);
    try {
      globalThis.localStorage?.setItem(`side:${btn.dataset.side ?? ""}`, open ? "open" : "closed");
    } catch {}
  };

  btn.addEventListener("click", () => set(!open));
  root.querySelector("[data-side-close]")?.addEventListener("click", () => set(false));
  globalThis.addEventListener("keydown", (e: Event) => {
    if ((e as KeyboardEvent).key === "Escape" && open && !wide()) set(false);
  });
}

/** 狭い画面で開いているサイドバーを閉じる。本文に覆いかぶさるため */
export function shutIfNarrow(root: HTMLElement): void {
  if (wide()) return;
  root.querySelector<HTMLButtonElement>("[data-side][aria-expanded='true']")?.click();
}

const wide = () => !(globalThis.matchMedia?.("(max-width: 1100px)").matches ?? false);
