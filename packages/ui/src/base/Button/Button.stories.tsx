import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const meta = {
  title: "コンポーネント/Base/Button",
  component: Button,
  args: { children: "保存" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const PrimaryHover: Story = {
  args: { variant: "primary" },
  parameters: { pseudo: { hover: true } },
};
export const PrimaryFocus: Story = {
  args: { variant: "primary" },
  parameters: { pseudo: { focusVisible: true } },
};
export const PrimaryDisabled: Story = { args: { variant: "primary", disabled: true } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Danger: Story = { args: { variant: "danger", children: "削除" } };
export const Loading: Story = { args: { isLoading: true } };
export const SecondaryLoading: Story = { args: { variant: "secondary", isLoading: true } };
export const Small: Story = { args: { size: "S" } };
