import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { PreviewFrame } from "./PreviewFrame";

const meta = {
  title: "コンポーネント/Case/PreviewFrame",
  component: PreviewFrame,
  args: {
    url: "https://client.example:3000/",
    onReload: fn(),
    children: <iframe srcDoc="<p>ダミーのプレビュー</p>" title="プレビューの画面" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-prose p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreviewFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "開いている" };
export const Empty: Story = {
  name: "空",
  args: { url: "about:blank", onReload: undefined, children: <iframe title="プレビューの画面" /> },
};
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "サーバーの起動を待っています" } },
};
export const Error: Story = {
  name: "エラー",
  args: { state: { kind: "error", title: "プレビューを開けませんでした" } },
};
export const LongUrl: Story = {
  name: "長い URL",
  args: {
    url: `https://client.example:3000/callback?${Array.from({ length: 10 }, (_, i) => `param${i}=value-${i}`).join("&")}`,
  },
};
