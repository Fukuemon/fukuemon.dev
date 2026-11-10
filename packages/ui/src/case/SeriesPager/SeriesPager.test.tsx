import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./SeriesPager.stories";

const { Middle, First, Last } = composeStories(stories);

describe("SeriesPager", () => {
  it("静的に描いた HTML に、シリーズの位置と前後の記事へのリンクがある", () => {
    const html = renderToStaticMarkup(<Middle />);
    expect(html).toContain('aria-label="シリーズ OAuth を手で追う"');
    expect(html).toContain("3 / 5");
    expect(html).toContain('href="#authorize"');
    expect(html).toContain('href="#refresh-token"');
  });

  it("前後の記事へのリンクは 44 px 四方以上で押せ、前と次の向きを名前に含む", () => {
    render(<Middle />);
    expect(
      screen.getByRole("navigation", { name: "シリーズ OAuth を手で追う" }),
    ).toBeInTheDocument();
    const prev = screen.getByRole("link", { name: /前の記事.*認可のリクエストを組み立てる/ });
    const next = screen.getByRole("link", { name: /次の記事.*リフレッシュトークンを回す/ });
    expect(prev).toHaveAttribute("rel", "prev");
    expect(next).toHaveAttribute("rel", "next");
    for (const link of [prev, next]) {
      const rect = link.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });

  it("最初の記事では前の記事の側を描かない", () => {
    render(<First />);
    expect(screen.queryByRole("link", { name: /前の記事/ })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /次の記事/ })).toBeInTheDocument();
  });

  it("最後の記事では次の記事の側を描かない", () => {
    render(<Last />);
    expect(screen.queryByRole("link", { name: /次の記事/ })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /前の記事/ })).toBeInTheDocument();
  });
});
