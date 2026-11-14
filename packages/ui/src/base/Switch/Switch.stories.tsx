import type { Meta, StoryObj } from "@storybook/react-vite";

import { Switch } from "./Switch";

const meta = {
  title: "コンポーネント/Base/Switch",
  component: Switch,
  args: { label: "AI からの操作を許可する" },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const OnDisabled: Story = { args: { disabled: true, defaultChecked: true } };
