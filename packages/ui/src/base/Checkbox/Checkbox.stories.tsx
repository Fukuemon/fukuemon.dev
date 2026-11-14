import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./Checkbox";

const meta = {
  title: "コンポーネント/Base/Checkbox",
  component: Checkbox,
  args: { label: "このページでは今後尋ねない" },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const CheckedHover: Story = {
  args: { defaultChecked: true },
  parameters: { pseudo: { hover: true } },
};
export const Disabled: Story = { args: { disabled: true } };
export const CheckedDisabled: Story = { args: { disabled: true, defaultChecked: true } };
