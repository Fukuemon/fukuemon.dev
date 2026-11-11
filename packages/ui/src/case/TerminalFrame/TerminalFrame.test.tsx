import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./TerminalFrame.stories";

const { Default, Loading, WithActions } = composeStories(stories);

describe("TerminalFrame", () => {
  it("題を領域の名前にし、エンジンにテーマの名前のテーマを渡す", () => {
    render(<Default themeName="dark" />);
    expect(screen.getByRole("region", { name: "端末" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "端末の出力" })).toHaveAttribute(
      "data-code-theme",
      "dark",
    );
  });

  it("読み込み中は、エンジンの代わりに待っていることを、コードの面でなく地の面に出す", () => {
    render(<Loading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("端末を起動しています");
    expect(screen.queryByRole("region", { name: "端末の出力" })).toBeNull();
    expect(status.closest(".bg-surface")).not.toBeNull();
    expect(status.closest(".bg-code-surface")).toBeNull();
  });

  it("動いているときは、エンジンをコードの面に描く", () => {
    render(<Default />);
    const engine = screen.getByRole("region", { name: "端末の出力" });
    expect(engine.closest(".bg-code-surface")).not.toBeNull();
  });

  it("actions を題の右に出す", () => {
    render(<WithActions />);
    expect(screen.getByRole("button", { name: "端末を消す" })).toBeInTheDocument();
  });
});
