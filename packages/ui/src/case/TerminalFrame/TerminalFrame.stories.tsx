import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from "../../base/IconButton/IconButton";
import { DummyEngine, TERMINAL_LINES } from "../ToolPane/fixtures";
import { TerminalFrame } from "./TerminalFrame";

const meta = {
  title: "コンポーネント/Case/TerminalFrame",
  component: TerminalFrame,
  args: {
    children: (theme) => <DummyEngine label="端末の出力" lines={TERMINAL_LINES} theme={theme} />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-prose p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TerminalFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "動いている" };
export const WithActions: Story = {
  name: "題の右の操作",
  args: {
    actions: (
      <IconButton
        icon={
          <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
            <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        }
        label="端末を消す"
      />
    ),
  },
};
export const Empty: Story = {
  name: "空",
  args: { children: (theme) => <DummyEngine label="端末の出力" lines={[]} theme={theme} /> },
};
export const Pending: Story = { name: "起動を待つ空", args: { state: { kind: "pending" } } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "端末を起動しています" } },
};
export const Error: Story = {
  name: "エラー",
  args: {
    state: {
      kind: "error",
      title: "端末を起動できませんでした",
      message: "ページを読み込み直してください。",
    },
  },
};
