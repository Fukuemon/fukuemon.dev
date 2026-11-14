import type { Meta, StoryObj } from "@storybook/react-vite";

import { PageLoading } from "./PageLoading";

const meta = {
  title: "コンポーネント/Base/PageLoading",
  component: PageLoading,
  args: { label: "実行環境を起動しています" },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "デフォルト" };
export const Database: Story = {
  name: "DB の読み込み",
  args: { label: "PGlite を読み込んでいます" },
};
