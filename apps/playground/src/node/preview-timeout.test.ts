import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchPreviewLoad } from "./preview-timeout";

const TIMEOUT = 30_000;

describe("watchPreviewLoad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("上限までに読み込まれないときは、上限の時点で onTimeout を呼ぶ", () => {
    const onTimeout = vi.fn();
    watchPreviewLoad(0, () => undefined, onTimeout, TIMEOUT);
    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("上限までに同じ世代が読み込まれたときは、onTimeout を呼ばない", () => {
    const onTimeout = vi.fn();
    let loaded: number | undefined;
    watchPreviewLoad(1, () => loaded, onTimeout, TIMEOUT);
    loaded = 1;
    vi.advanceTimersByTime(TIMEOUT);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("前の世代だけが読み込まれたときは、onTimeout を呼ぶ", () => {
    const onTimeout = vi.fn();
    watchPreviewLoad(2, () => 1, onTimeout, TIMEOUT);
    vi.advanceTimersByTime(TIMEOUT);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("見せ直したときに、読み込み済みの世代では onTimeout を呼ばない", () => {
    const onTimeout = vi.fn();
    watchPreviewLoad(0, () => 0, onTimeout, TIMEOUT);
    vi.advanceTimersByTime(TIMEOUT);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("待つのをやめた後は、onTimeout を呼ばない", () => {
    const onTimeout = vi.fn();
    const stop = watchPreviewLoad(0, () => undefined, onTimeout, TIMEOUT);
    stop();
    vi.advanceTimersByTime(TIMEOUT);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
