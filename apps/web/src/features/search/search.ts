type Hit = { url: string; meta: { title?: string }; excerpt: string };
type Result = { data: () => Promise<Hit> };
type Pagefind = { search: (q: string) => Promise<{ results: Result[] }> };

const MAX = 12;
const DEBOUNCE = 160;

/**
 * 実体参照を文字へ戻す。DOMParser は切り離した文書を作るので、
 * 途中に markup があってもスクリプトは動かず、textContent は文字列にしかならない
 */
const decodeEntities = (s: string): string =>
  new DOMParser().parseFromString(s, "text/html").body.textContent ?? "";

/**
 * excerpt を `<mark>` で分け、地の文はテキストとして入れる。
 * Pagefind は `<` と `>` をエスケープするので `innerHTML` でも要素にはならない (2026-08-31 実測)。
 * それでも要素を作らないのは、安全が Pagefind の実装に依存しない形にするためである。
 */
function excerptNodes(excerpt: string): Node[] {
  const out: Node[] = [];
  for (const [i, part] of excerpt.split(/<\/?mark>/).entries()) {
    if (part === "") continue;
    const text = decodeEntities(part);
    if (i % 2 === 0) {
      out.push(document.createTextNode(text));
    } else {
      const m = document.createElement("mark");
      m.textContent = text;
      out.push(m);
    }
  }
  return out;
}

/** 読み込み口は SiteSearch.astro の is:inline な script が置く */
type Loader = () => Promise<Pagefind>;
const loader = (): Loader | undefined => (globalThis as { loadPagefind?: Loader }).loadPagefind;

export function mountSearch(root: ParentNode = document): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-search]");
  const input = root.querySelector<HTMLInputElement>("[data-search-input]");
  const list = root.querySelector<HTMLOListElement>("[data-search-list]");
  const note = root.querySelector<HTMLElement>("[data-search-note]");
  const open = root.querySelector<HTMLButtonElement>("[data-search-open]");
  const close = root.querySelector<HTMLButtonElement>("[data-search-close]");
  if (!dialog || !input || !list || !note || !open) return;

  let engine: Pagefind | null = null;
  let loading: Promise<Pagefind | null> | undefined;
  let seq = 0;

  const load = (): Promise<Pagefind | null> => {
    loading ??= (loader()?.() ?? Promise.reject(new Error("読み込み口がありません")))
      .then((m) => (engine = m))
      .catch(() => null);
    return loading;
  };

  const say = (text: string) => {
    note.textContent = text;
    note.hidden = false;
    list.replaceChildren();
  };

  const render = (hits: Hit[]) => {
    note.hidden = true;
    list.replaceChildren(
      ...hits.map((h) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "search__hit";
        a.href = h.url.startsWith("/") ? h.url : "/";
        const title = document.createElement("span");
        title.className = "search__title";
        title.textContent = h.meta.title ?? h.url;
        const body = document.createElement("span");
        body.className = "meta search__excerpt";
        body.append(...excerptNodes(h.excerpt));
        a.append(title, body);
        li.append(a);
        return li;
      }),
    );
  };

  const run = async (q: string) => {
    const mine = ++seq;
    if (q.trim() === "") return say("語を入れてください");

    const pf = engine ?? (await load());
    if (mine !== seq) return;
    if (!pf) return say("検索はビルドした版でだけ使えます");

    const { results } = await pf.search(q);
    if (mine !== seq) return;
    if (results.length === 0) return say("見つかりませんでした");

    const hits = await Promise.all(results.slice(0, MAX).map((r) => r.data()));
    if (mine !== seq) return;
    render(hits);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(input.value), DEBOUNCE);
  });

  open.addEventListener("click", () => {
    dialog.showModal();
    input.focus();
    void load();
  });
  close?.addEventListener("click", () => dialog.close());
}
