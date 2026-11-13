import { describe, expect, it } from "vitest";
import { SEEN_KEY, takeFirstVisit } from "./visit";

function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  };
}

const fail = () => {
  throw new DOMException("blocked", "SecurityError");
};

describe("takeFirstVisit", () => {
  it("初めて開いたときは true を返す", () => {
    expect(takeFirstVisit(() => memory())).toBe(true);
  });

  it("開いたことを fd-top-seen に記録する", () => {
    const store = memory();
    takeFirstVisit(() => store);
    expect(store.items.get(SEEN_KEY)).toBe("1");
  });

  it("同じ端末で 2 回目に開いたときは false を返す", () => {
    const store = memory();
    takeFirstVisit(() => store);
    expect(takeFirstVisit(() => store)).toBe(false);
  });

  it("localStorage に触れると例外を投げる端末では、false を返す", () => {
    expect(takeFirstVisit(fail)).toBe(false);
  });

  it("読めない端末では、false を返す", () => {
    expect(takeFirstVisit(() => ({ ...memory(), getItem: fail }))).toBe(false);
  });

  it("書けない端末では、false を返す", () => {
    expect(takeFirstVisit(() => ({ ...memory(), setItem: fail }))).toBe(false);
  });
});
