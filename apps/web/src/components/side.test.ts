import { runInThisContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySide, mountSide, shutIfNarrow, tuckOnScroll } from "./side";

/** DOM の代役。テスト環境に DOM は無く、side.ts が使う口だけを持たせる */
class FakeEl {
  dataset: Record<string, string | undefined> = {};
  attrs = new Map<string, string>();
  title = "";
  listeners = new Map<string, () => void>();
  children = new Map<string, FakeEl>();
  root: FakeEl | null = null;

  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  closest() {
    return this.root;
  }
  querySelector(sel: string) {
    if (sel === "[data-side][aria-expanded='true']") {
      const btn = this.children.get("[data-side]");
      return btn?.attrs.get("aria-expanded") === "true" ? btn : null;
    }
    return this.children.get(sel) ?? null;
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, fn);
  }
  click() {
    this.listeners.get("click")?.();
  }
}

/** 版面、開閉ボタン、覆いを組む */
function build(id = "doc") {
  const root = new FakeEl();
  const btn = new FakeEl();
  const scrim = new FakeEl();
  btn.dataset.side = id;
  btn.root = root;
  root.children.set("[data-side]", btn);
  root.children.set("[data-side-close]", scrim);
  const el = <T>(x: FakeEl) => x as unknown as T;
  return { root, btn, scrim, el };
}

function stubStorage(impl?: Partial<Storage>) {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    ...impl,
  });
  return map;
}

/** `narrow` が true なら 1100px 以下として答える */
function stubWidth(narrow: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(max-width: 1100px)" && narrow }));
}

let keydown: ((e: Event) => void) | undefined;
let scroll: (() => void) | undefined;

/** 画面を `y` まで流したことにする */
function scrollTo(y: number) {
  vi.stubGlobal("scrollY", y);
  scroll?.();
}

beforeEach(() => {
  vi.unstubAllGlobals();
  keydown = undefined;
  scroll = undefined;
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("addEventListener", (type: string, fn: (e: Event) => void) => {
    if (type === "keydown") keydown = fn;
    if (type === "scroll") scroll = fn as () => void;
  });
});

describe("applySide", () => {
  it("保存が無ければ、広い画面で開く", () => {
    stubStorage();
    stubWidth(false);
    const { root, btn, el } = build();
    expect(applySide(el(btn))).toBe(true);
    expect(root.dataset.open).toBe("true");
    expect(btn.attrs.get("aria-expanded")).toBe("true");
    expect(btn.title).toBe("閉じる");
  });

  it("保存が無ければ、狭い画面で閉じる", () => {
    stubStorage();
    stubWidth(true);
    const { root, btn, el } = build();
    expect(applySide(el(btn))).toBe(false);
    expect(root.dataset.open).toBe("false");
    expect(btn.attrs.get("aria-expanded")).toBe("false");
    expect(btn.title).toBe("開く");
  });

  it("保存した状態を画面の幅より優先し、鍵を id で分ける", () => {
    const map = stubStorage();
    map.set("side:lab", "open");
    map.set("side:doc", "closed");
    const lab = build("lab");
    const doc = build("doc");
    stubWidth(true);
    expect(applySide(lab.el(lab.btn))).toBe(true);
    stubWidth(false);
    expect(applySide(doc.el(doc.btn))).toBe(false);
  });

  it("localStorage が例外を投げても、画面の幅から決める", () => {
    stubStorage({
      getItem: () => {
        throw new Error("denied");
      },
    });
    stubWidth(true);
    const { btn, el } = build();
    expect(applySide(el(btn))).toBe(false);
  });

  it("matchMedia が無ければ広い画面として扱う", () => {
    stubStorage();
    vi.stubGlobal("matchMedia", undefined);
    const { btn, el } = build();
    expect(applySide(el(btn))).toBe(true);
  });

  it("状態を渡すと、保存と幅を見ずにそれを当てる", () => {
    stubStorage().set("side:doc", "open");
    stubWidth(false);
    const { root, btn, el } = build();
    expect(applySide(el(btn), false)).toBe(false);
    expect(root.dataset.open).toBe("false");
  });

  it("版面が無くてもボタンには当てる", () => {
    stubStorage();
    stubWidth(false);
    const { btn, el } = build();
    btn.root = null;
    expect(applySide(el(btn))).toBe(true);
    expect(btn.attrs.get("aria-expanded")).toBe("true");
  });

  it("文字列にして inline script で評価しても同じ結果になる", () => {
    stubStorage();
    stubWidth(true);
    const { root, btn } = build();
    const inline = runInThisContext(`(${String(applySide)})`) as (b: FakeEl) => boolean;
    expect(inline(btn)).toBe(false);
    expect(root.dataset.open).toBe("false");
  });
});

describe("mountSide", () => {
  it("ボタンが無ければ何もしない", () => {
    const root = new FakeEl();
    mountSide(root as unknown as HTMLElement);
    expect(root.dataset.open).toBeUndefined();
  });

  it("ボタンで開閉を切り替え、状態を保存する", () => {
    const map = stubStorage();
    stubWidth(false);
    const { root, btn, el } = build();
    mountSide(el(root));
    expect(root.dataset.open).toBe("true");
    btn.click();
    expect(root.dataset.open).toBe("false");
    expect(btn.attrs.get("aria-expanded")).toBe("false");
    expect(map.get("side:doc")).toBe("closed");
    btn.click();
    expect(map.get("side:doc")).toBe("open");
  });

  it("覆いを押すと閉じる", () => {
    stubStorage().set("side:doc", "open");
    stubWidth(true);
    const { root, scrim, el } = build();
    mountSide(el(root));
    scrim.click();
    expect(root.dataset.open).toBe("false");
  });

  it("Escape は狭い画面で開いているときだけ閉じる", () => {
    stubStorage().set("side:doc", "open");
    stubWidth(false);
    const { root, el } = build();
    mountSide(el(root));
    keydown?.({ key: "Escape" } as unknown as Event);
    expect(root.dataset.open).toBe("true");
    stubWidth(true);
    keydown?.({ key: "Enter" } as unknown as Event);
    expect(root.dataset.open).toBe("true");
    keydown?.({ key: "Escape" } as unknown as Event);
    expect(root.dataset.open).toBe("false");
  });

  it("保存に失敗しても開閉は切り替わる", () => {
    stubStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });
    stubWidth(false);
    const { root, btn, el } = build();
    mountSide(el(root));
    btn.click();
    expect(root.dataset.open).toBe("false");
  });
});

describe("shutIfNarrow", () => {
  it("狭い画面で開いていれば閉じ、広い画面では触らない", () => {
    stubStorage().set("side:doc", "open");
    stubWidth(false);
    const { root, el } = build();
    mountSide(el(root));
    shutIfNarrow(el(root));
    expect(root.dataset.open).toBe("true");
    stubWidth(true);
    shutIfNarrow(el(root));
    expect(root.dataset.open).toBe("false");
  });
});

describe("tuckOnScroll", () => {
  function tucked() {
    stubWidth(true);
    const { btn, el } = build();
    btn.setAttribute("aria-expanded", "false");
    tuckOnScroll(el(btn));
    return btn;
  }

  it("狭い画面で下へ流すと隠し、上へ戻すと出す", () => {
    const btn = tucked();
    scrollTo(300);
    expect(btn.dataset.tuck).toBe("");
    scrollTo(200);
    expect(btn.dataset.tuck).toBeUndefined();
  });

  it("揺れの幅に収まる動きでは出し入れしない", () => {
    const btn = tucked();
    scrollTo(300);
    scrollTo(295);
    expect(btn.dataset.tuck).toBe("");
  });

  it("広い画面と、開いているときは隠さない", () => {
    const btn = tucked();
    stubWidth(false);
    scrollTo(300);
    expect(btn.dataset.tuck).toBeUndefined();
    stubWidth(true);
    btn.setAttribute("aria-expanded", "true");
    scrollTo(600);
    expect(btn.dataset.tuck).toBeUndefined();
  });

  it("フォーカスが来たら出す", () => {
    const btn = tucked();
    scrollTo(300);
    btn.listeners.get("focus")?.();
    expect(btn.dataset.tuck).toBeUndefined();
  });
});
