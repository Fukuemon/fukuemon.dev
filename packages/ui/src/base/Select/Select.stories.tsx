import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select } from "./Select";

const options = [10, 50, 100].map((size) => (
  <option key={size} value={size}>
    {size}
  </option>
));

const meta = {
  title: "コンポーネント/Base/Select",
  component: Select,
  args: { label: "1 ページの行", defaultValue: 50, children: options },
  decorators: [
    (Story) => (
      <div className="bg-surface-pane p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Compact: Story = { name: "compact", args: { density: "compact" } };
