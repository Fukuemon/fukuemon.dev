import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Notice.stories";

const { Compact, Danger, Warning } = composeStories(stories);

describe("Notice", () => {
  it("静的に描いた HTML に、題と本文の文字がある", () => {
    const html = renderToStaticMarkup(<Warning />);
    expect(html).toContain("注意");
    expect(html).toContain("本番のデータベースでは流さない。");
  });

  it("記事の注意書きは role を持たず、isAlert の知らせだけを alert として読み上げる", () => {
    const { unmount } = render(<Warning />);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();
    render(<Danger />);
    expect(screen.getByRole("alert")).toHaveTextContent("実行に失敗しました");
  });

  it("density を compact にすると、題を 13 px、余白を 8 px にする（ADR-0062）", () => {
    render(<Compact />);
    const title = screen.getByText(/./, { selector: "p" });
    expect(getComputedStyle(title).fontSize).toBe("13px");
    expect(getComputedStyle(title.parentElement?.parentElement as Element).paddingTop).toBe("8px");
  });
});
