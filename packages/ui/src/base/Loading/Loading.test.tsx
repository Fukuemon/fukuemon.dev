import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Loading.stories";

const { Compact, Default } = composeStories(stories);

describe("Loading", () => {
  it("待っていることを status の文で示し、罫の印は読み上げない", () => {
    render(<Default />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("実行環境を起動しています");
    expect(status.querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("印は、border の色の罫の上で、主の色の罫を animate-loading で動かす", () => {
    render(
      <>
        <Default />
        <span className="bg-primary" data-testid="primary" />
      </>,
    );
    const mark = screen.getByRole("status").querySelector("[aria-hidden]")!;
    const stroke = getComputedStyle(mark, "::after");
    expect(stroke.animationName).toBe("fd-loading-stroke");
    expect(stroke.animationFillMode).toBe("none");
    expect(stroke.backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("primary")).backgroundColor,
    );
    expect(mark.getBoundingClientRect().height).toBe(2);
  });

  it("density を compact にすると、文を 13 px にする（ADR-0062）", () => {
    render(<Compact />);
    expect(getComputedStyle(screen.getByRole("status")).fontSize).toBe("13px");
  });
});
