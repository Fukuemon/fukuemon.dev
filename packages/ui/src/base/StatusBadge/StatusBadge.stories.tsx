import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusBadge } from "./StatusBadge";

const meta = {
  title: "コンポーネント/Base/StatusBadge",
  component: StatusBadge,
  args: { tone: "neutral", label: "ハンズオン" },
} satisfies Meta<typeof StatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = { name: "成否なし" };
export const Info: Story = { name: "情報", args: { tone: "info", label: "302 Found" } };
export const Success: Story = { name: "成功", args: { tone: "success", label: "200 OK" } };
export const Warning: Story = {
  name: "注意",
  args: { tone: "warning", label: "404 Not Found" },
};
export const Danger: Story = {
  name: "エラー",
  args: { tone: "danger", label: "500 Internal Server Error" },
};
