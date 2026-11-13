type SeenStore = Pick<Storage, "getItem" | "setItem">;

export const SEEN_KEY = "fd-top-seen";

/**
 * 端末で初めてトップを開いたかを返し、開いたことを記録する。
 * `localStorage` を読めないか書けない端末では、最初の訪問かを判定できないので、`false` を返す。
 * `localStorage` に触れるだけで例外を投げるブラウザがあるので、取り出す関数で受け取る。
 */
export function takeFirstVisit(storage: () => SeenStore): boolean {
  try {
    const store = storage();
    const seen = store.getItem(SEEN_KEY) !== null;
    store.setItem(SEEN_KEY, "1");
    return !seen;
  } catch {
    return false;
  }
}
