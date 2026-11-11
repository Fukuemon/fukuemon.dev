import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./TerminalFrame.stories";

const { Default, Loading } = composeStories(stories);

describe("TerminalFrame", () => {
  it("題を領域の名前にし、エンジンにテーマの名前のテーマを渡す", () => {
    render(<Default themeName="dark" />);
    expect(screen.getByRole("region", { name: "端末" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "端末の出力" })).toHaveAttribute(
      "data-code-theme",
      "dark",
    );
  });

  it("読み込み中は、エンジンの代わりに待っていることを読み上げる", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("端末を起動しています");
    expect(screen.queryByRole("region", { name: "端末の出力" })).toBeNull();
  });
});
