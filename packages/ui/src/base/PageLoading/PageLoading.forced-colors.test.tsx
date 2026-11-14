import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { canvas, style, useForcedColors } from "../../test/forced-colors";
import * as stories from "./PageLoading.stories";

const { Default } = composeStories(stories);

describe("PageLoading の forced-colors: active", () => {
  useForcedColors();

  it("筆の線が、背景と違う色で塗られ、筆の線の形のまま出る", () => {
    render(<Default />);
    const line = screen.getByRole("status").querySelector("[aria-hidden]") as Element;
    expect({
      painted: style(line).backgroundColor !== canvas(),
      brush: style(line).maskImage !== "none",
    }).toStrictEqual({ painted: true, brush: true });
  });
});
