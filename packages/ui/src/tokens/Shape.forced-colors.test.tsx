import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../test/forced-colors";
import * as stories from "./Shape.stories";

const { Overview, BandCurrent } = composeStories(stories);

// システムの色の実際の値はブラウザと OS で変わるので、同じ指定の要素を描かせて期待の値にする
const canvasText = () => {
  const probe = document.createElement("div");
  probe.style.color = "CanvasText";
  document.body.append(probe);
  const color = style(probe).color;
  probe.remove();
  return color;
};

describe("band の forced-colors: active", () => {
  useForcedColors();

  it.each([
    { attribute: "aria-pressed", Story: Overview, names: ["春", "秋"] },
    { attribute: "aria-current", Story: BandCurrent, names: ["朝", "昼"] },
  ])(
    "$attribute で選択中の子要素を、背景と選択していない子要素と違う色で塗り、文字を CanvasText のままにし、ステッチを描かない",
    ({ Story, names }) => {
      render(<Story />);
      const [plain, picked] = names.map((name) => style(screen.getByRole("button", { name })));
      expect({
        filled: picked?.backgroundColor !== canvas(),
        distinct: picked?.backgroundColor !== plain?.backgroundColor,
        text: picked?.color,
        stitch: picked?.backgroundImage,
      }).toStrictEqual({ filled: true, distinct: true, text: canvasText(), stitch: "none" });
    },
  );
});
