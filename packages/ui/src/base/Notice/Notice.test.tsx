import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import * as stories from "./Notice.stories";

const { Danger, Warning } = composeStories(stories);

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
});
