/**
 * Yaegi で動かすコードの net/http が使う fetch を、Web Worker と同じ origin へのリクエストだけを通すものにする (ADR-0064)。
 * ほかの origin へのリクエストは、送らずに失敗させる。redirect を error にして、同じ origin からのリダイレクトでほかの origin に届かないようにする。
 * Go のコードは、ヘッダの js.fetch:redirect で redirect を指定できるので、渡された値を上書きする。
 */
export function sameOriginFetch(realFetch: typeof fetch, origin: string): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    if (url.origin !== origin) {
      return Promise.reject(new TypeError(`ほかの origin へは送れません: ${url.origin}`));
    }
    return realFetch(input, { ...init, redirect: "error" });
  };
}
