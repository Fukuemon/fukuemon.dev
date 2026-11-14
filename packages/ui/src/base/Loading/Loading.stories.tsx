import type { Meta, StoryObj } from "@storybook/react-vite";

import { Loading } from "./Loading";

const meta = {
  title: "コンポーネント/Base/Loading",
  component: Loading,
  args: { label: "サーバーが待ち受けるのを待っています" },
} satisfies Meta<typeof Loading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "デフォルト" };
export const Install: Story = {
  name: "パッケージのインストール",
  args: { label: "パッケージをインストールしています" },
};
export const Compact: Story = { name: "compact", args: { density: "compact" } };
