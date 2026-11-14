import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./TerminalFrame.stories";

const { Default, Loading, Pending, WithActions } = composeStories(stories);

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
    expect(status.closest(".bg-surface-pane")).not.toBeNull();
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

  it("エンジンを置く枠のフォーカスの輪は、枠の内側に引く（ADR-0066）", () => {
    render(<Default />);
    const engine = screen.getByRole("region", { name: "端末の出力" });
    engine.focus();
    const ring = getComputedStyle(engine.parentElement as HTMLElement, "::after");
    expect({
      ring: [ring.outlineStyle, ring.outlineOffset],
      own: getComputedStyle(engine).outlineStyle,
    }).toStrictEqual({ ring: ["solid", "-2px"], own: "none" });
  });

  it("起動を待つ pending のときは、エンジンも待ちの文も出さず、操作も出さない", () => {
    render(<Pending actions={<button type="button">端末を消す</button>} />);
    expect({
      region: screen.getByRole("region", { name: "端末" }) !== null,
      engine: screen.queryByRole("region", { name: "端末の出力" }),
      status: screen.queryByRole("status"),
      action: screen.queryByRole("button"),
    }).toStrictEqual({ region: true, engine: null, status: null, action: null });
  });
});
