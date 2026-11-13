type SeenStore = Pick<Storage, "getItem" | "setItem">;

/**
 * 端末で初めてトップを開いたかを返し、開いたことを `fd-top-seen` に記録する。
 * `localStorage` を読めないか書けない端末では、最初の訪問かを判定できないので、`false` を返す。
 * `localStorage` に触れるだけで例外を投げるブラウザがあるので、取り出す関数で受け取る。
 *
 * `head` の inline script に文字列にして埋め込むので、この関数の外の名前を参照しない。
 * 呼ぶたびに記録するので、`head` の inline script だけが 1 回呼ぶ。場面は `html` の class `intro` を読む。
 */
export function takeFirstVisit(storage: () => SeenStore): boolean {
  try {
    const store = storage();
    const seen = store.getItem("fd-top-seen") !== null;
    store.setItem("fd-top-seen", "1");
    return !seen;
  } catch {
    return false;
  }
}
