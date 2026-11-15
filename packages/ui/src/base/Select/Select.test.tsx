import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { fn } from "storybook/test";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import * as stories from "./Select.stories";

const { Default, Compact } = composeStories(stories);

describe("Select", () => {
  it("見出しを欄の名前に結び、選んだ値を onChange に渡す", async () => {
    const onChange = fn();
    render(<Default onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "1 ページの行" });
    await userEvent.selectOptions(select, "100");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue("100");
  });

  it("デフォルトは 48 px、compact は 28 px の高さにする", () => {
    render(<Default />);
    render(<Compact label="compact の行" />);
    expect(
      screen.getByRole("combobox", { name: "1 ページの行" }).getBoundingClientRect().height,
    ).toBe(48);
    expect(
      screen.getByRole("combobox", { name: "compact の行" }).getBoundingClientRect().height,
    ).toBe(28);
  });
});
