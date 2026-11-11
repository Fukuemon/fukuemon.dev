import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";

import { HttpExchangeDetail } from "./HttpExchangeDetail";
import * as stories from "./HttpExchangeDetail.stories";

const { Default, WithCookie, Unreached, Empty, LongUrlAndHeaders } = composeStories(stories);

describe("HttpExchangeDetail", () => {
  it("リクエストとレスポンスのヘッダの表と本文を出す", () => {
    render(<Default />);
    expect(screen.getByRole("table", { name: "リクエストのヘッダ" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "レスポンスのヘッダ" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "レスポンスの本文" })).toHaveTextContent(
      "invalid_grant",
    );
  });

  it("Cookie と Set-Cookie のヘッダを、ヘッダの表から分けて Cookie の表に出す", () => {
    render(<WithCookie />);
    const cookies = screen.getByRole("table", { name: "Cookie のヘッダ" });
    expect(cookies).toHaveTextContent("Set-Cookie");
    expect(screen.getByRole("table", { name: "レスポンスのヘッダ" })).not.toHaveTextContent(
      "Set-Cookie",
    );
  });

  it("Cookie のほかにヘッダが無いメッセージでは、表の代わりに文を出す", () => {
    render(
      <HttpExchangeDetail
        actors={[]}
        exchange={{
          id: "1",
          fromId: "browser",
          toId: "client",
          method: "GET",
          url: "https://client.example/",
          status: 204,
          request: { headers: [{ name: "Cookie", value: "session=dummy" }] },
          response: { headers: [] },
        }}
      />,
    );
    expect(screen.getAllByText("ヘッダはありません。")).toHaveLength(2);
    expect(screen.getByRole("table", { name: "Cookie のヘッダ" })).toHaveTextContent("session");
  });

  it("届かなかったリクエストでは、レスポンスの側を出さない", () => {
    render(<Unreached />);
    expect(screen.getByText("届かなかった")).toBeInTheDocument();
    expect(screen.queryByText("レスポンス")).toBeNull();
  });

  it("行き来を渡さないときは、選ぶよう案内する", () => {
    render(<Empty />);
    expect(screen.getByText("一覧から通信を選ぶと、ここに詳細を出します。")).toBeInTheDocument();
  });

  it("長い URL とヘッダは、詳細の幅を超えず、本文はその枠の中だけで横に送る", async () => {
    await page.viewport(360, 800);
    render(<LongUrlAndHeaders />);
    const pane = screen.getByRole("region", { name: "通信の詳細" });
    expect(pane.scrollWidth).toBeLessThanOrEqual(pane.clientWidth + 2);
    const body = screen.getByRole("region", { name: "レスポンスの本文" });
    expect(body.scrollWidth).toBeGreaterThan(body.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  });

  it("開閉の要約は 44 px 以上の高さで押せる", () => {
    render(<Default />);
    for (const summary of document.querySelectorAll("summary")) {
      expect(summary.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });
});
