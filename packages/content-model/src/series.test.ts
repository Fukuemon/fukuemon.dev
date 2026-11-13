import { describe, expect, it } from "vitest";
import {
  DuplicateOrderError,
  MissingOrderError,
  MissingSeriesIndexError,
  NestedSeriesError,
  StandaloneOrderError,
  planSeries,
} from "./series.js";

const indexed = (...names: string[]) => new Set(names);

describe("planSeries", () => {
  it("空の入力から空の計画を作る", () => {
    expect(planSeries([], indexed())).toStrictEqual([]);
  });

  it("シリーズに入れない記事は計画に現れない", () => {
    expect(planSeries([{ path: "alone.md" }], indexed())).toStrictEqual([]);
  });

  it("シリーズの記事を order の昇順に並べる", () => {
    const plans = planSeries(
      [
        { path: "s/c.md", order: 3 },
        { path: "s/a.md", order: 1 },
        { path: "s/b.mdx", order: 2 },
      ],
      indexed("s"),
    );
    expect(plans).toStrictEqual([{ name: "s", articlePaths: ["s/a.md", "s/b.mdx", "s/c.md"] }]);
  });

  it("シリーズごとに別の計画を作る", () => {
    const plans = planSeries(
      [
        { path: "x/a.md", order: 1 },
        { path: "y/a.md", order: 1 },
      ],
      indexed("x", "y"),
    );
    expect(plans.map((p) => p.name)).toStrictEqual(["x", "y"]);
  });

  it("order が重複したら、重複した記事のパスを載せて失敗する", () => {
    const run = () =>
      planSeries(
        [
          { path: "s/a.md", order: 1 },
          { path: "s/b.md", order: 1 },
        ],
        indexed("s"),
      );
    expect(run).toThrow(DuplicateOrderError);
    expect(run).toThrow("s/a.md, s/b.md");
  });

  it("別のシリーズで同じ order を使ってよい", () => {
    expect(() =>
      planSeries(
        [
          { path: "x/a.md", order: 1 },
          { path: "y/a.md", order: 1 },
        ],
        indexed("x", "y"),
      ),
    ).not.toThrow();
  });

  it("シリーズの記事に order が無ければ、そのパスを載せて失敗する", () => {
    const run = () => planSeries([{ path: "s/a.md" }], indexed("s"));
    expect(run).toThrow(MissingOrderError);
    expect(run).toThrow("s/a.md");
  });

  it("シリーズに入れない記事が order を書いたら、そのパスを載せて失敗する", () => {
    const run = () => planSeries([{ path: "alone.md", order: 1 }], indexed());
    expect(run).toThrow(StandaloneOrderError);
    expect(run).toThrow("alone.md");
  });

  it("シリーズのディレクトリの下にディレクトリがあれば、そのパスを載せて失敗する", () => {
    const run = () => planSeries([{ path: "s/t/a.md", order: 1 }], indexed("s"));
    expect(run).toThrow(NestedSeriesError);
    expect(run).toThrow("s/t/a.md");
  });

  it("シリーズに index.md が無ければ失敗する", () => {
    const run = () => planSeries([{ path: "s/a.md", order: 1 }], indexed());
    expect(run).toThrow(MissingSeriesIndexError);
    expect(run).toThrow("s/a.md");
  });
});
