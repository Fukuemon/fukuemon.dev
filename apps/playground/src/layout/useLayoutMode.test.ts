import { afterEach, describe, expect, it, vi } from "vitest";

import { currentLayoutMode, subscribeLayoutMode } from "./useLayoutMode";

/** 合う media query の集まりを受け、その query だけが合う `matchMedia` を置く。 */
const stubMatchMedia = (matching: string[]) => {
  const queries = new Map<
    string,
    { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> }
  >();
  vi.stubGlobal("window", {
    matchMedia: (query: string) => {
      const listeners = queries.get(query) ?? {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      queries.set(query, listeners);
      return { matches: matching.some((part) => query.includes(part)), ...listeners };
    },
  });
  return queries;
};

describe("currentLayoutMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["幅も高さも足りる画面は wide", [], "wide"],
    ["幅が 48rem 未満の画面は narrow", ["max-width"], "narrow"],
    ["高さが 500px 未満の画面は short", ["max-height"], "short"],
    ["幅も高さも足りない画面は、高さを先に見て short", ["max-width", "max-height"], "short"],
  ])("%s", (_, matching, expected) => {
    stubMatchMedia(matching);
    expect(currentLayoutMode()).toBe(expected);
  });
});

describe("subscribeLayoutMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("幅と高さの 2 つの query を購読し、返した関数で同じ関数の購読を解く", () => {
    const queries = stubMatchMedia([]);
    const onChange = vi.fn();
    subscribeLayoutMode(onChange)();
    expect(
      [...queries.values()].map(({ addEventListener, removeEventListener }) => [
        addEventListener.mock.calls,
        removeEventListener.mock.calls,
      ]),
    ).toStrictEqual([
      [[["change", onChange]], [["change", onChange]]],
      [[["change", onChange]], [["change", onChange]]],
    ]);
  });
});
