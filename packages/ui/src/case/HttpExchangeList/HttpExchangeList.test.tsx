import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser/context";

import { HttpExchangeList } from "./HttpExchangeList";
import * as stories from "./HttpExchangeList.stories";

const { Default, Empty, Loading, Error } = composeStories(stories);

const rows = () => screen.getAllByRole("button");

describe("HttpExchangeList", () => {
  it("2xx、3xx、4xx、5xx と届かなかった行に、状態コードの文字と状態の色を出す", () => {
    render(<Default />);
    const expected = [
      ["302", "border-info"],
      ["200", "border-success"],
      ["400", "border-warning"],
      ["503", "border-danger"],
      ["届かなかった", "border-danger"],
    ];
    rows().forEach((row, index) => {
      const [label, className] = expected[index] ?? [];
      const badge = within(row).getByText(label ?? "");
      expect(badge).toHaveClass(className ?? "");
    });
  });

  it("行の読み上げる名前に、者の名前、メソッド、URL、状態コードを含める", () => {
    render(<Default />);
    expect(rows()[2]).toHaveAccessibleName(
      "クライアント から 認可サーバー POST https://auth.example/token 400",
    );
  });

  it("行は 44 px 以上の高さで押せ、押した行を選ぶ", async () => {
    render(<Default />);
    for (const row of rows()) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(rows()[2]).toHaveAttribute("aria-current", "true");
    await userEvent.click(rows()[0] as HTMLElement);
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
    expect(rows()[2]).not.toHaveAttribute("aria-current");
  });

  it("200 未満の状態コードは灰の印にし、actors に無い者は id を 1 つ目の区別の色で出す", () => {
    render(
      <HttpExchangeList
        actors={[{ id: "browser", name: "ブラウザ" }]}
        exchanges={[
          { id: "1", fromId: "browser", toId: "worker", method: "GET", url: "/", status: 101 },
        ]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("101")).toHaveClass("border-border");
    expect(screen.getByText("worker")).toHaveClass("text-categorical-1");
  });

  it("空、読み込み中、エラーでは、行の代わりに文を出す", () => {
    const { unmount } = render(<Empty />);
    expect(screen.getByText("まだ通信がありません。")).toBeInTheDocument();
    unmount();
    const loading = render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("通信を待っています");
    loading.unmount();
    render(<Error />);
    expect(screen.getByRole("alert")).toHaveTextContent("通信の記録を読めませんでした");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
