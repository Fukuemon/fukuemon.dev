import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConsoleEntryList } from "./ConsoleEntryList";
import { ENTRIES, LONG_ENTRY, MANY_ENTRIES } from "./fixtures";

const meta = {
  title: "コンポーネント/Case/ConsoleEntryList",
  component: ConsoleEntryList,
  args: { entries: ENTRIES },
  decorators: [
    (Story) => (
      <div className="max-w-prose p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleEntryList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "ログレベルごと" };
export const Expanded: Story = {
  name: "値を開いている",
  play: async ({ canvas, userEvent }) => {
    for (const name of [/^\{id: 42/, /^session:/, /^TypeError/, /^Map\(2\)/]) {
      await userEvent.click(canvas.getByRole("treeitem", { name }));
    }
  },
};
export const Hover: Story = {
  name: "hover",
  parameters: { pseudo: { hover: true } },
  play: Expanded.play,
};
export const FixedHeight: Story = {
  name: "高さを決めた枠",
  args: { entries: MANY_ENTRIES },
  decorators: [
    (Story) => (
      <div className="flex h-96 flex-col">
        <Story />
      </div>
    ),
  ],
};
export const ErrorOnly: Story = { name: "error だけを表示", args: { defaultLevels: ["error"] } };
export const NoMatch: Story = { name: "選んだログレベルの行が無い", args: { defaultLevels: [] } };
export const Empty: Story = { name: "空", args: { entries: [] } };
export const Pending: Story = { name: "起動を待つ空", args: { state: { kind: "pending" } } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "実行環境を起動しています" } },
};
export const Error: Story = {
  name: "エラー",
  args: {
    state: {
      kind: "error",
      title: "コンソールの記録を読めませんでした",
      message: "実行環境を起動し直してください。",
    },
  },
};
export const LongValue: Story = { name: "長い値", args: { entries: [LONG_ENTRY] } };
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
