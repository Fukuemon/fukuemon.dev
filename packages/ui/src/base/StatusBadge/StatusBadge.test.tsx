import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./StatusBadge.stories";

const { Compact, Danger, Success } = composeStories(stories);

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

  it("density を compact にすると、文字を 12 px にする（ADR-0062）", () => {
    render(<Compact />);
    expect(getComputedStyle(screen.getByText("200")).fontSize).toBe("12px");
  });
});
