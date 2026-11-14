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
import * as stories from "./Tabs.stories";

const { Closable } = composeStories(stories);

describe("Tabs の forced-colors: active", () => {
  useForcedColors();

  it("選んだタブの下の帯が、背景と違う色で塗られる", () => {
    render(<Closable />);
    const indicator = screen.getByRole("tab", { selected: true }).previousElementSibling as Element;
    expect(style(indicator).backgroundColor).not.toBe(canvas());
  });

  it("Tab のキーでフォーカスを受けると、フォーカスの輪が出る", async () => {
    render(<Closable />);
    expect(await outlineAfterTab(screen.getByRole("tab", { selected: true }))).toStrictEqual(
      FOCUS_RING,
    );
  });
});
