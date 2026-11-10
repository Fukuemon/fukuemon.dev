import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from "./IconButton";

const closeIcon = (
  <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
    <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const meta = {
  title: "コンポーネント/Base/IconButton",
  component: IconButton,
  args: { label: "閉じる", icon: closeIcon },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
