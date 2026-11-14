import type { Meta, StoryObj } from "@storybook/react-vite";

import { ACTORS, EXCHANGES, LONG_EXCHANGE } from "../HttpExchangeList/fixtures";
import { HttpExchangeDetail } from "./HttpExchangeDetail";

const meta = {
  title: "コンポーネント/Case/HttpExchangeDetail",
  component: HttpExchangeDetail,
  args: { actors: ACTORS, exchange: EXCHANGES[2] },
  decorators: [
    (Story) => (
      <div className="max-w-body p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HttpExchangeDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "リクエストとレスポンス" };
export const WithCookie: Story = { name: "Cookie あり", args: { exchange: EXCHANGES[0] } };
export const Unreached: Story = { name: "届かなかった", args: { exchange: EXCHANGES[4] } };
export const Empty: Story = { name: "空", args: { exchange: undefined } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "通信の詳細を読んでいます" } },
};
export const Error: Story = {
  name: "エラー",
  args: { state: { kind: "error", title: "通信の詳細を読めませんでした" } },
};
export const LongUrlAndHeaders: Story = {
  name: "長い URL とヘッダ",
  args: { exchange: LONG_EXCHANGE },
};
