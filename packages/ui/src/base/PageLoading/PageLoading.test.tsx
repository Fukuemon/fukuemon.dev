import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./PageLoading.stories";

const { Default } = composeStories(stories);

describe("PageLoading", () => {
  it("待っていることを status の文で示し、筆の線の印は読み上げない", () => {
    render(<Default />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("実行環境を起動しています");
    expect(status.querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("画面の右下に固定し、文を 13px にする", () => {
    render(<Default />);
    const style = getComputedStyle(screen.getByRole("status"));
    expect(style.position).toBe("fixed");
    expect(style.right).toBe("24px");
    expect(style.bottom).toBe("20px");
    expect(style.fontSize).toBe("13px");
  });

  it("印は、主の色の筆の線を animate-loading で動かす", () => {
    render(
      <>
        <Default />
        <span className="bg-primary" data-testid="primary" />
      </>,
    );
    const mark = screen.getByRole("status").querySelector<HTMLElement>("[aria-hidden]")!;
    const style = getComputedStyle(mark);
    expect(style.animationName).toBe("fd-loading-stroke");
    expect(style.animationFillMode).toBe("none");
    expect(style.maskImage).toContain("svg");
    expect(style.backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("primary")).backgroundColor,
    );
  });
});
