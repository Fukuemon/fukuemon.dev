import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./IconButton.stories";

const { Default } = composeStories(stories);

describe("IconButton", () => {
  it("label を名前にし、44×44 px で押せる", () => {
    render(<Default />);
    const button = screen.getByRole("button", { name: "閉じる" });
    const rect = button.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  });
});
