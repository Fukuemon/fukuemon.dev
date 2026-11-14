import { describe, expect, it } from "vitest";
import { findEmbedNames } from "./embeds";

describe("原稿の埋め込みの名前", () => {
  it("playground のフェンスの中身を、書いた順に返す", () => {
    const md = "本文\n\n```playground\nfirst\n```\n\n> ```playground\n> second\n> ```\n";
    expect(findEmbedNames(md)).toStrictEqual(["first", "second"]);
  });

  it("ほかの言語のフェンスは数えない", () => {
    expect(findEmbedNames("```js\nplayground\n```\n")).toStrictEqual([]);
  });
});
