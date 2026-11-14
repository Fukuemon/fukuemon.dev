import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./ConsoleEntryList.stories";

const { Default } = composeStories(stories);

describe("ConsoleEntryList の forced-colors: active", () => {
  useForcedColors();

  it("debug、log、info の行の左の罫は背景に溶け、warn と error の行の左の罫と、最後でない行の区切りの下の罫は出る", () => {
    render(<Default />);
    const rows = [
      ...screen.getByRole("region", { name: "ログの行" }).querySelectorAll(":scope > ol > li"),
    ];
    const edges = rows.map((row) => ({
      level: row.querySelector(".sr-only")?.textContent,
      left: style(row).borderLeftColor !== canvas(),
      bottom: style(row).borderBottomWidth !== "0px" && style(row).borderBottomColor !== canvas(),
    }));
    expect(edges).toStrictEqual([
      { level: "debug", left: false, bottom: true },
      { level: "log", left: false, bottom: true },
      { level: "info", left: false, bottom: true },
      { level: "warn", left: true, bottom: true },
      { level: "error", left: true, bottom: true },
      { level: "log", left: false, bottom: true },
      { level: "log", left: false, bottom: false },
    ]);
  });
});
