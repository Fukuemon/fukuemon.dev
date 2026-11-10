import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./StatusBadge.stories";

const { Danger, Success } = composeStories(stories);

describe("StatusBadge", () => {
  it("状態を文字で出し、種類ごとに枠の色を変える", () => {
    render(
      <>
        <Success />
        <Danger />
      </>,
    );
    const success = screen.getByText("200 OK");
    const danger = screen.getByText("500 Internal Server Error");
    expect(getComputedStyle(success).borderColor).not.toBe(getComputedStyle(danger).borderColor);
  });
});
