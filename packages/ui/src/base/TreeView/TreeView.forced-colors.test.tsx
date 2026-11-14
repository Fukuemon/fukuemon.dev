import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./TreeView.stories";

const { CompactBody } = composeStories(stories);

describe("TreeView の forced-colors: active", () => {
  useForcedColors();

  it("選んだ項目の塗りが、選んでいない項目と違い、選んでいない項目の左の枠は背景に溶ける", () => {
    render(<CompactBody />);
    const items = screen.getAllByRole("treeitem");
    const selected = items.find((item) => item.getAttribute("aria-selected") === "true") as Element;
    const other = items.find((item) => item.getAttribute("aria-selected") === "false") as Element;
    expect({
      fillDiffers: style(selected).backgroundColor !== style(other).backgroundColor,
      otherEdgeHidden: style(other).borderLeftColor === canvas(),
      selectedEdgeShown: style(selected).borderLeftColor !== canvas(),
    }).toStrictEqual({ fillDiffers: true, otherEdgeHidden: true, selectedEdgeShown: true });
  });
});
