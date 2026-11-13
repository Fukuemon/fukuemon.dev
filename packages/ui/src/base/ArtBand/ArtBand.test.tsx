import { composeStories } from "@storybook/react-vite";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ArtBand } from "./ArtBand";
import * as stories from "./ArtBand.stories";

const { Seigaiha } = composeStories(stories);

describe("ArtBand", () => {
  it("静的に描いた HTML で、帯を読み上げから外し、SVG に読み上げの名前を付けない", () => {
    for (const motif of ["kasumi", "seigaiha", "moonPine"] as const) {
      const html = renderToStaticMarkup(<ArtBand layout="fill" motif={motif} />);
      expect(html).toMatch(/^<div aria-hidden="true"/);
      expect(html).toContain("<svg");
      expect(html).not.toContain('role="img"');
      expect(html).not.toContain("aria-label");
    }
  });

  it("band は 120 px の高さで、挿絵が帯の全体を埋める", () => {
    const { container } = render(<Seigaiha />);
    const band = container.querySelector('[data-motif="seigaiha"]');
    if (!band) throw new Error("帯が無い");
    const rect = band.getBoundingClientRect();
    expect(rect.height).toBe(120);
    const svg = band.querySelector("svg");
    if (!svg) throw new Error("SVG が無い");
    expect(svg.getBoundingClientRect().width).toBe(rect.width);
    expect(svg.getBoundingClientRect().height).toBe(120);
  });

  it("動きの層は、5 秒以内に終わる 1 回だけの遷移で濃度を上げて出て、位置を動かさない", () => {
    for (const motif of ["kasumi", "moonPine"] as const) {
      const { container, unmount } = render(<ArtBand layout="fill" motif={motif} />);
      const layers = container.querySelectorAll(`[data-motif="${motif}"] > div`);
      expect(layers).toHaveLength(2);
      const style = getComputedStyle(layers[1]);
      expect(style.animationName).toBe("none");
      expect(style.transitionProperty).toBe("opacity");
      const seconds = Number.parseFloat(style.transitionDuration);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(5);
      unmount();
    }
  });
});
