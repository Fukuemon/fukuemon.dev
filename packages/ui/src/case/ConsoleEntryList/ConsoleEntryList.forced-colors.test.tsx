import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./ConsoleEntryList.stories";

const { Default } = composeStories(stories);

describe("ConsoleEntryList の forced-colors: active", () => {
  useForcedColors();

  it("debug、log、info の行の左の罫は背景に溶け、warn と error の行の左の罫は出る", () => {
    render(<Default />);
    const rows = screen
      .getByRole("region", { name: "ログの行" })
      .querySelectorAll(":scope > ol > li");
    const edgeShown = [...rows].map((row) => style(row).borderLeftColor !== canvas());
    const levels = [...rows].map((row) => row.querySelector(".sr-only")?.textContent);
    expect(
      Object.fromEntries(levels.map((level, index) => [level, edgeShown[index]])),
    ).toStrictEqual({
      debug: false,
      log: false,
      info: false,
      warn: true,
      error: true,
    });
  });
});
