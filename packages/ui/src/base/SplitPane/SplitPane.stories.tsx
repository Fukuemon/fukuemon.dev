import type { Meta, StoryObj } from "@storybook/react-vite";

import { SplitPane } from "./SplitPane";

const meta = {
  title: "コンポーネント/Base/SplitPane",
  component: SplitPane,
  args: {
    label: "エディタとプレビューの境界",
    primary: <p className="p-4 text-body text-text">エディタ</p>,
    secondary: <p className="p-4 text-body text-text">プレビュー</p>,
  },
  decorators: [
    (Story) => (
      <div className="h-80 w-full border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitPane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = { name: "左右に並べる" };
export const Vertical: Story = {
  name: "上下に並べる",
  args: {
    label: "エディタと端末の境界",
    orientation: "vertical",
    defaultSize: 70,
    secondary: <p className="p-4 text-body text-text">端末</p>,
  },
};
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
