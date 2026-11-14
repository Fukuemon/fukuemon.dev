import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./SplitPane.stories";

const { Horizontal } = composeStories(stories);

describe("SplitPane の forced-colors: active", () => {
  useForcedColors();

  it("区切りの線が、背景と違う色で塗られる", () => {
    render(<Horizontal />);
    const line = screen.getByRole("separator").firstElementChild as Element;
    expect(style(line).backgroundColor).not.toBe(canvas());
  });
});
