import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { FOCUS_RING, outlineAfterTab, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./Switch.stories";

const { Off, On, Disabled, OnDisabled } = composeStories(stories);

const track = (ui: React.ReactElement) => {
  const { unmount } = render(ui);
  const control = screen.getByRole("switch");
  const result = {
    borderWidth: style(control).borderTopWidth,
    borderColor: style(control).borderTopColor,
    trackBackground: style(control).backgroundColor,
    thumbBackground: style(control.firstElementChild as Element).backgroundColor,
  };
  unmount();
  return result;
};

describe("Switch の forced-colors: active", () => {
  useForcedColors();

  it("オフの溝に枠があり、つまみが溝と違う色で塗られる", () => {
    const off = track(<Off />);
    expect({
      border: off.borderWidth,
      thumbDiffers: off.thumbBackground !== off.trackBackground,
    }).toStrictEqual({ border: "1px", thumbDiffers: true });
  });

  it("オンの溝の塗りと、つまみの塗りが、オフと違う", () => {
    const off = track(<Off />);
    const on = track(<On />);
    expect({
      trackDiffers: on.trackBackground !== off.trackBackground,
      thumbDiffers: on.thumbBackground !== on.trackBackground,
    }).toStrictEqual({ trackDiffers: true, thumbDiffers: true });
  });

  it("無効のオフは枠の色が有効と違い、無効のオンは溝の塗りが有効と違う", () => {
    const off = track(<Off />);
    const on = track(<On />);
    const offDisabled = track(<Disabled />);
    const onDisabled = track(<OnDisabled />);
    expect({
      offBorderDiffers: offDisabled.borderColor !== off.borderColor,
      offThumbDiffers: offDisabled.thumbBackground !== offDisabled.trackBackground,
      onTrackDiffers: onDisabled.trackBackground !== on.trackBackground,
      onThumbDiffers: onDisabled.thumbBackground !== onDisabled.trackBackground,
    }).toStrictEqual({
      offBorderDiffers: true,
      offThumbDiffers: true,
      onTrackDiffers: true,
      onThumbDiffers: true,
    });
  });

  it("Tab のキーでフォーカスを受けると、フォーカスの輪が出る", async () => {
    render(<Off />);
    expect(await outlineAfterTab(screen.getByRole("switch"))).toStrictEqual(FOCUS_RING);
  });
});
