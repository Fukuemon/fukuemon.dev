import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { FOCUS_RING, outlineAfterTab, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./Checkbox.stories";

const { Unchecked, Checked, Disabled, CheckedDisabled } = composeStories(stories);

const box = (ui: React.ReactElement) => {
  const { unmount } = render(ui);
  const input = screen.getByRole("checkbox");
  const result = {
    borderWidth: style(input).borderTopWidth,
    borderColor: style(input).borderTopColor,
    background: style(input).backgroundColor,
    mark: style(input.nextElementSibling as Element).color,
  };
  unmount();
  return result;
};

describe("Checkbox の forced-colors: active", () => {
  useForcedColors();

  it("オフの箱に枠がある", () => {
    expect(box(<Unchecked />).borderWidth).toBe("1px");
  });

  it("オンの塗りがオフと違い、チェックの印が塗りと違う色である", () => {
    const unchecked = box(<Unchecked />);
    const checked = box(<Checked />);
    expect({
      fillDiffers: checked.background !== unchecked.background,
      markDiffers: checked.mark !== checked.background,
    }).toStrictEqual({ fillDiffers: true, markDiffers: true });
  });

  it("無効のオフは枠の色が有効と違い、無効のオンは塗りが有効と違う", () => {
    const unchecked = box(<Unchecked />);
    const checked = box(<Checked />);
    const disabled = box(<Disabled />);
    const checkedDisabled = box(<CheckedDisabled />);
    expect({
      offBorderDiffers: disabled.borderColor !== unchecked.borderColor,
      onFillDiffers: checkedDisabled.background !== checked.background,
      onMarkDiffers: checkedDisabled.mark !== checkedDisabled.background,
    }).toStrictEqual({ offBorderDiffers: true, onFillDiffers: true, onMarkDiffers: true });
  });

  it("Tab のキーでフォーカスを受けると、フォーカスの輪が出る", async () => {
    render(<Unchecked />);
    expect(await outlineAfterTab(screen.getByRole("checkbox"))).toStrictEqual(FOCUS_RING);
  });
});
