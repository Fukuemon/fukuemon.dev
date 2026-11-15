import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../test/forced-colors";
import * as stories from "./Shape.stories";

const { BandCurrent } = composeStories(stories);

describe("band の forced-colors: active", () => {
  useForcedColors();

  it("選択中の子要素を、背景と違う色で塗り、ステッチを描かない", () => {
    render(<BandCurrent />);
    const picked = style(screen.getByRole("button", { name: "昼" }));
    expect({
      filled: picked.backgroundColor !== canvas(),
      stitch: picked.backgroundImage,
    }).toStrictEqual({ filled: true, stitch: "none" });
  });
});
