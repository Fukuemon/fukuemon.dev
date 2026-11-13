import { describe, expect, it } from "vitest";

import { joinParts } from "./parts";

const urls = [new URL("https://play.example/a.wasm"), new URL("https://play.example/b.wasm")];

describe("joinParts", () => {
  it("取得した順につなぎ、content-type を application/wasm にする", async () => {
    const bodies: Record<string, string> = { "/a.wasm": "ab", "/b.wasm": "cd" };
    const joined = await joinParts(urls, async (url) => new Response(bodies[url.pathname]));
    expect([await joined.text(), joined.headers.get("content-type")]).toStrictEqual([
      "abcd",
      "application/wasm",
    ]);
  });

  it("どれかを取得できないときは、URL と status を付けて失敗する", async () => {
    const failing = (url: URL) =>
      Promise.resolve(new Response("x", { status: url.pathname === "/b.wasm" ? 404 : 200 }));
    await expect(joinParts(urls, failing)).rejects.toThrow(
      "https://play.example/b.wasm を取得できませんでした（404）",
    );
  });
});
