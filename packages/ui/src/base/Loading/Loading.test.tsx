import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Loading.stories";

const { Default } = composeStories(stories);

describe("Loading", () => {
  it("待っていることを status の文で示し、回転の印は読み上げない", () => {
    render(<Default />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("実行環境を起動しています");
    expect(status.querySelector("[aria-hidden]")).not.toBeNull();
  });
});
