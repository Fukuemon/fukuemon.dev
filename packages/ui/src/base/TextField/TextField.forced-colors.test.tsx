import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./TextField.stories";

const { Underline } = composeStories(stories);

describe("TextField の forced-colors: active", () => {
  useForcedColors();

  it("下罫が背景と違う色で塗られ、フォーカスを受けると筆の線が見える色で出る", async () => {
    render(<Underline />);
    const input = screen.getByRole("textbox");
    const [rule, focusLine] = Array.from(
      input.parentElement?.querySelectorAll("[aria-hidden]") ?? [],
    );
    await userEvent.click(input);
    expect({
      ruleShown: style(rule as Element).backgroundColor !== canvas(),
      focusLineShown: style(focusLine as Element).backgroundColor !== canvas(),
      focusLineVisible: style(focusLine as Element).visibility,
    }).toStrictEqual({ ruleShown: true, focusLineShown: true, focusLineVisible: "visible" });
  });
});
