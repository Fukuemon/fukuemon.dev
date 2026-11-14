import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";

import { PageLoading } from "./PageLoading";
import * as stories from "./PageLoading.stories";

const { Default } = composeStories(stories);

function Page({ loading }: { loading: boolean }) {
  return (
    <>
      <button type="button">実行する</button>
      {loading && <PageLoading label="PGlite を読み込んでいます" />}
    </>
  );
}

function Toggle() {
  const [loading, setLoading] = useState(false);
  return (
    <>
      <button onClick={() => setLoading((value) => !value)} type="button">
        切り替える
      </button>
      {loading && <PageLoading label="PGlite を読み込んでいます" />}
    </>
  );
}

describe("PageLoading", () => {
  it("待っていることを status の文で示し、筆の線の印は読み上げない", () => {
    render(<Default />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("実行環境を起動しています");
    expect(status.querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("画面の全体を紙の面で覆い、13px の文を中央に置く", () => {
    render(
      <>
        <Default />
        <span className="bg-surface-pane" data-testid="pane" />
      </>,
    );
    const status = screen.getByRole("status");
    const cover = getComputedStyle(status.parentElement!);
    const box = status.getBoundingClientRect();
    expect({
      position: cover.position,
      inset: [cover.top, cover.right, cover.bottom, cover.left],
      background: cover.backgroundColor,
      fontSize: getComputedStyle(status).fontSize,
      centered: Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 1,
    }).toStrictEqual({
      position: "fixed",
      inset: ["0px", "0px", "0px", "0px"],
      background: getComputedStyle(screen.getByTestId("pane")).backgroundColor,
      fontSize: "13px",
      centered: true,
    });
  });

  it("印は、主の色の筆の線を animate-loading で動かす", () => {
    render(
      <>
        <Default />
        <span className="bg-primary" data-testid="primary" />
      </>,
    );
    const mark = screen.getByRole("status").querySelector<HTMLElement>("[aria-hidden]")!;
    const style = getComputedStyle(mark);
    expect(style.animationName).toBe("fd-loading-stroke");
    expect(style.animationFillMode).toBe("none");
    expect(style.maskImage).toContain("svg");
    expect(style.backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("primary")).backgroundColor,
    );
  });

  it("覆っている間は、覆いの外の要素を inert にし、消えたら戻す", () => {
    const { rerender } = render(<Page loading />);
    const button = screen.getByText("実行する");
    expect(button.closest("[inert]")).not.toBeNull();
    rerender(<Page loading={false} />);
    expect(button.closest("[inert]")).toBeNull();
  });

  it("消えたときは、覆う前にフォーカスがあった要素へフォーカスを戻す", async () => {
    render(<Toggle />);
    const button = screen.getByRole("button", { name: "切り替える" });
    button.focus();
    button.click();
    await expect.poll(() => screen.queryByRole("status")).not.toBeNull();
    expect(document.activeElement).not.toBe(button);
    button.click();
    await expect.poll(() => document.activeElement).toBe(button);
  });
});
