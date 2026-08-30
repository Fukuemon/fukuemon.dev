/** 側柱の開閉を `root` に取り付ける。状態は `localStorage` に置く */
export function mountSide(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>("[data-side]");
  if (!btn) return;
  const key = `side:${btn.dataset.side ?? ""}`;

  const apply = (open: boolean) => {
    root.dataset.open = String(open);
    btn.setAttribute("aria-expanded", String(open));
    btn.title = open ? "たたむ" : "ひらく";
  };

  let open = wide();
  try {
    const saved = globalThis.localStorage?.getItem(key);
    if (saved) open = saved === "open";
  } catch {}
  apply(open);

  const set = (next: boolean) => {
    open = next;
    apply(open);
    try {
      globalThis.localStorage?.setItem(key, open ? "open" : "closed");
    } catch {}
  };

  btn.addEventListener("click", () => set(!open));
  root.querySelector("[data-side-close]")?.addEventListener("click", () => set(false));
  globalThis.addEventListener("keydown", (e: Event) => {
    if ((e as KeyboardEvent).key === "Escape" && open && !wide()) set(false);
  });
}

/** 狭い画面で開いている側柱を畳む。本文に覆いかぶさるため */
export function shutIfNarrow(root: HTMLElement): void {
  if (wide()) return;
  root.querySelector<HTMLButtonElement>("[data-side][aria-expanded='true']")?.click();
}

/** CSS の折り返しと同じ問いにする。1101px と書くと 1100.5px で両方が偽になる */
const wide = () => !(globalThis.matchMedia?.("(max-width: 1100px)").matches ?? false);
