import { describe, expect, it, vi } from "vitest";

import { sameOriginFetch } from "./guard";

const origin = "https://play.fukuemon.dev";

describe("sameOriginFetch", () => {
  it("同じ origin へは、redirect を error にして送る", async () => {
    const real = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const guarded = sameOriginFetch(real, origin);
    await guarded("/go/", { redirect: "follow", method: "GET" });
    await guarded(new Request(`${origin}/a`));
    expect(real.mock.calls[0]?.[1]).toStrictEqual({ redirect: "error", method: "GET" });
    expect(real.mock.calls[1]?.[1]).toStrictEqual({ redirect: "error" });
  });

  it.each([["https://example.com/"], ["http://play.fukuemon.dev/"], ["//evil.example/x"]])(
    "ほかの origin（%s）へは送らずに失敗させる",
    async (url) => {
      const real = vi.fn<typeof fetch>();
      await expect(sameOriginFetch(real, origin)(url)).rejects.toThrow(TypeError);
      expect(real).not.toHaveBeenCalled();
    },
  );

  it("URL にできない値は、送らずに失敗させる", async () => {
    const real = vi.fn<typeof fetch>();
    await expect(sameOriginFetch(real, origin)("http://[bad")).rejects.toThrow(TypeError);
    expect(real).not.toHaveBeenCalled();
  });
});
