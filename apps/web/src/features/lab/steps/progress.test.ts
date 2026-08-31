import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_EVENT, completeStep, loadProgress, saveProgress } from "./progress";

/** localStorage の代役。実物はテスト環境に無く、例外を投げる経路も試したい */
function stubStorage(impl?: Partial<Storage>) {
  const map = new Map<string, string>();
  const store: Storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    ...impl,
  };
  vi.stubGlobal("localStorage", store);
  return map;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("loadProgress", () => {
  it("保存が無ければ undefined", () => {
    stubStorage();
    expect(loadProgress("a", 5)).toBeUndefined();
  });

  it("壊れた JSON を読んでも落ちない", () => {
    stubStorage().set("lab:a", "{");
    expect(loadProgress("a", 5)).toBeUndefined();
  });

  it("object でない JSON を弾く", () => {
    stubStorage().set("lab:a", "42");
    expect(loadProgress("a", 5)).toBeUndefined();
  });

  it("型が合わない値を弾く", () => {
    stubStorage().set("lab:a", JSON.stringify({ completedSteps: "x", lastStep: 1 }));
    expect(loadProgress("a", 5)).toBeUndefined();
  });

  it("手順を減らすと、範囲外の番号を取り除く", () => {
    stubStorage().set("lab:a", JSON.stringify({ completedSteps: [0, 2, 9], lastStep: 9 }));
    expect(loadProgress("a", 3)).toEqual({ completedSteps: [0, 2], lastStep: 2 });
  });

  it("重複と順序を正す", () => {
    stubStorage().set("lab:a", JSON.stringify({ completedSteps: [2, 0, 2], lastStep: 1 }));
    expect(loadProgress("a", 5)).toEqual({ completedSteps: [0, 2], lastStep: 1 });
  });

  it("整数でない番号を取り除く", () => {
    stubStorage().set("lab:a", JSON.stringify({ completedSteps: [0, 1.5, -1], lastStep: 0 }));
    expect(loadProgress("a", 5)?.completedSteps).toEqual([0]);
  });

  it("localStorage が例外を投げてもページを壊さない", () => {
    stubStorage({
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadProgress("a", 5)).toBeUndefined();
  });

  it("localStorage 自体が無くても落ちない", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadProgress("a", 5)).toBeUndefined();
  });
});

describe("saveProgress", () => {
  it("書けなくても island へは値が届く", () => {
    stubStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });
    const dispatch = vi.fn();
    vi.stubGlobal("dispatchEvent", dispatch);
    saveProgress("a", { completedSteps: [1], lastStep: 1 });
    expect(dispatch).toHaveBeenCalledOnce();
    const ev = dispatch.mock.calls[0]?.[0] as CustomEvent;
    expect(ev.type).toBe(PROGRESS_EVENT);
    expect(ev.detail).toEqual({ contentId: "a", value: { completedSteps: [1], lastStep: 1 } });
  });

  it("イベント機構が無くても保存だけは通る", () => {
    const map = stubStorage();
    vi.stubGlobal("dispatchEvent", undefined);
    saveProgress("a", { completedSteps: [0], lastStep: 0 });
    expect(map.get("lab:a")).toContain('"lastStep":0');
  });
});

describe("completeStep", () => {
  it("完了を積み、番号順に並べる", () => {
    stubStorage();
    completeStep("a", 2, 5);
    completeStep("a", 0, 5);
    expect(loadProgress("a", 5)).toEqual({ completedSteps: [0, 2], lastStep: 2 });
  });

  it("同じ手順を 2 度完了にしない", () => {
    stubStorage();
    completeStep("a", 1, 5);
    completeStep("a", 1, 5);
    expect(loadProgress("a", 5)?.completedSteps).toEqual([1]);
  });

  it("lastStep を後戻りさせない", () => {
    stubStorage();
    completeStep("a", 3, 5);
    completeStep("a", 1, 5);
    expect(loadProgress("a", 5)?.lastStep).toBe(3);
  });
});
