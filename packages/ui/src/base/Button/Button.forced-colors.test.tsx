import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import {
  canvas,
  FOCUS_RING,
  outlineAfterTab,
  style,
  useForcedColors,
} from "../../test/forced-colors";
import * as stories from "./Button.stories";

const { Primary, PrimaryDisabled, Loading, Small } = composeStories(stories);

const frame = (ui: React.ReactElement) => {
  const { unmount } = render(ui);
  const button = screen.getByRole("button");
  const result = { width: style(button).borderTopWidth, color: style(button).borderTopColor };
  unmount();
  return result;
};

describe("Button の forced-colors: active", () => {
  useForcedColors();

  it("有効と無効のどちらにも枠があり、枠の色が違う", () => {
    const enabled = frame(<Primary />);
    const disabled = frame(<PrimaryDisabled />);
    expect({
      enabledWidth: enabled.width,
      disabledWidth: disabled.width,
      colorDiffers: disabled.color !== enabled.color,
    }).toStrictEqual({ enabledWidth: "1px", disabledWidth: "1px", colorDiffers: true });
  });

  it("読み込み中の 3 つの点が、背景と違う色で塗られる", () => {
    render(<Loading />);
    const dot = screen.getByRole("button").querySelector("[aria-hidden] > span") as Element;
    expect(style(dot).backgroundColor).not.toBe(canvas());
  });

  it("S は、枠が増えても、見た目の上下の 2px 外まで押せる", () => {
    render(
      <div className="p-4">
        <Small />
      </div>,
    );
    const button = screen.getByRole("button", { name: "保存" });
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    expect([
      document.elementFromPoint(centerX, rect.top - 1.5),
      document.elementFromPoint(centerX, rect.bottom + 1.5),
    ]).toStrictEqual([button, button]);
  });

  it("Tab のキーでフォーカスを受けると、フォーカスの輪が出る", async () => {
    render(<Primary />);
    expect(await outlineAfterTab(screen.getByRole("button"))).toStrictEqual(FOCUS_RING);
  });
});
