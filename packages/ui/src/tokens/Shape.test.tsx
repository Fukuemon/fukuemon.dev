import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Shape.stories";

const { Overview } = composeStories(stories);

const styleOf = (name: string) => getComputedStyle(screen.getByRole("button", { name }));

describe("band", () => {
  it("グループの端の角だけを 4 px で丸め、隣の子要素と 1 px 重ねて境の線を 1 本にする", () => {
    render(<Overview />);
    const [first, middle, last] = ["自動", "春", "冬"].map(styleOf);
    expect({
      first: [first?.borderTopLeftRadius, first?.borderTopRightRadius],
      middle: [middle?.borderTopLeftRadius, middle?.marginLeft],
      last: [last?.borderTopLeftRadius, last?.borderBottomRightRadius],
    }).toStrictEqual({
      first: ["4px", "0px"],
      middle: ["0px", "-1px"],
      last: ["0px", "4px"],
    });
  });

  it("子要素に枠線とステッチを描き、選択中の子要素は背景と文字の色を反転して手前に出す", () => {
    render(<Overview />);
    const [plain, picked] = ["春", "秋"].map(styleOf);
    expect({
      border: plain?.borderTopWidth,
      stitched: plain?.backgroundImage.includes("repeating-linear-gradient"),
      inverted:
        picked?.backgroundColor === plain?.color && picked?.color === plain?.backgroundColor,
      zIndex: picked?.zIndex,
    }).toStrictEqual({ border: "1px", stitched: true, inverted: true, zIndex: "10" });
  });
});
