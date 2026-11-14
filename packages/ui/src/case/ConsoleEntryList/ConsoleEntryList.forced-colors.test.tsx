import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./ConsoleEntryList.stories";

const { Default } = composeStories(stories);

describe("ConsoleEntryList の forced-colors: active", () => {
  useForcedColors();

  it("debug、log、info の行の左の罫は背景に溶け、warn と error の行の左の罫と、行の区切りの下の罫は出る", () => {
    render(<Default />);
    const rows = [
      ...screen.getByRole("region", { name: "ログの行" }).querySelectorAll(":scope > ol > li"),
    ];
    const edges = rows.map((row) => ({
      level: row.querySelector(".sr-only")?.textContent,
      left: style(row).borderLeftColor !== canvas(),
      bottom: style(row).borderBottomColor !== canvas(),
    }));
    const levels = edges.map(({ level }) => level);
    expect(edges).toStrictEqual(
      levels.map((level) => ({ level, left: level === "warn" || level === "error", bottom: true })),
    );
    expect(new Set(levels)).toStrictEqual(new Set(["debug", "log", "info", "warn", "error"]));
  });
});
