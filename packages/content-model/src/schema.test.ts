import { describe, expect, it } from "vitest";
import { articleSchema, seriesSchema } from "./schema.js";

const base = {
  contentId: "intro",
  title: "t",
  description: "d",
  tags: ["postgres"],
  publishedAt: "2026-01-01",
};

describe("articleSchema", () => {
  it("format を省くと page になる", () => {
    expect(articleSchema.parse(base).format).toBe("page");
  });

  it("format: steps は受け付けない", () => {
    expect(articleSchema.safeParse({ ...base, format: "steps" }).success).toBe(false);
  });

  it("整数でない order は受け付けない", () => {
    expect(articleSchema.safeParse({ ...base, order: 1.5 }).success).toBe(false);
  });

  it("整数の order を受け付ける", () => {
    expect(articleSchema.parse({ ...base, order: 2 }).order).toBe(2);
  });

  it("実行環境の項目 interactive を持たない", () => {
    const parsed = articleSchema.parse({ ...base, interactive: { level: "local" } });
    expect("interactive" in parsed).toBe(false);
  });
});

describe("seriesSchema", () => {
  it("説明が無ければ受け付けない", () => {
    expect(seriesSchema.safeParse({ title: "t" }).success).toBe(false);
  });

  it("タイトルと説明を受け付ける", () => {
    expect(seriesSchema.parse({ title: "t", description: "d" })).toStrictEqual({
      title: "t",
      description: "d",
    });
  });
});
