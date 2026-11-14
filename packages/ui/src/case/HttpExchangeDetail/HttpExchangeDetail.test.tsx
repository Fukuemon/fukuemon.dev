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

  describe("本文の右端のぼかし", () => {
    const renderLongBody = async () => {
      await page.viewport(360, 800);
      render(<LongUrlAndHeaders />);
      return screen.getByRole("region", { name: "レスポンスの本文" });
    };

    it("横に続くあいだは、右端のぼかしを出す", async () => {
      const body = await renderLongBody();
      await expect.poll(() => getComputedStyle(body, "::after").opacity).toBe("1");
    });

    it("右端まで送ると、ぼかしを消す", async () => {
      const body = await renderLongBody();
      body.scrollLeft = body.scrollWidth;
      await expect.poll(() => getComputedStyle(body, "::after").opacity).toBe("0");
    });

    it("ぼかしは、本文の背景と同じ色で終わる", async () => {
      const body = await renderLongBody();
      expect(getComputedStyle(body, "::after").backgroundImage).toContain(
        getComputedStyle(body).backgroundColor,
      );
    });

    it("本文は、ぼかしと同じセルに重なり、行が増えない", async () => {
      const body = await renderLongBody();
      const code = body.querySelector("code") as Element;
      expect(body.clientHeight).toBeCloseTo(code.getBoundingClientRect().height, 0);
    });

    it("余白は本文の側にあり、ぼかしは枠の右端まで届く", async () => {
      const body = await renderLongBody();
      expect(getComputedStyle(body).paddingRight).toBe("0px");
    });
  });

  it("開閉の要約は 24 px の高さで押せ、表のセルの上下の余白は 2px、文字は 13 px にする（ADR-0062）", () => {
    render(<Default />);
    for (const summary of document.querySelectorAll("summary")) {
      expect(summary.getBoundingClientRect().height).toBe(24);
      expect(getComputedStyle(summary).fontSize).toBe("13px");
    }
    const cell = document.querySelector("td") as Element;
    expect(getComputedStyle(cell).paddingTop).toBe("2px");
    expect(getComputedStyle(cell).fontSize).toBe("13px");
  });
});
