import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ACTORS, EXCHANGES, LONG_EXCHANGE } from "./fixtures";
import { HttpExchangeList, type HttpExchangeListProps } from "./HttpExchangeList";

/** 選んだ行を state で持つ例。 */
function HttpExchangeListExample(props: Omit<HttpExchangeListProps, "onSelect">) {
  const [selectedId, setSelectedId] = useState(props.selectedId);
  return <HttpExchangeList {...props} onSelect={setSelectedId} selectedId={selectedId} />;
}

const meta = {
  title: "コンポーネント/Case/HttpExchangeList",
  component: HttpExchangeListExample,
  args: { actors: ACTORS, exchanges: EXCHANGES },
  decorators: [
    (Story) => (
      <div className="max-w-body p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HttpExchangeListExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "状態コードごと", args: { selectedId: "3" } };
export const Empty: Story = { name: "空", args: { exchanges: [] } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "通信を待っています" } },
};
export const Error: Story = {
  name: "エラー",
  args: {
    state: {
      kind: "error",
      title: "通信の記録を読めませんでした",
      message: "実行環境を起動し直してください。",
    },
  },
};
export const LongUrl: Story = { name: "長い URL", args: { exchanges: [LONG_EXCHANGE] } };
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
