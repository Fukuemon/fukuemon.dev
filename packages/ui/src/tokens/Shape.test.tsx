import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Shape.stories";

const { Overview } = composeStories(stories);

describe("band", () => {
  it("帯の外側の角だけを 4 px で丸め、隣の子と 1 px 重ねて境の線を 1 本にする", () => {
    render(<Overview />);
    const [first, middle, last] = ["自動", "春", "冬"].map((name) =>
      getComputedStyle(screen.getByRole("button", { name })),
    );
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
});
