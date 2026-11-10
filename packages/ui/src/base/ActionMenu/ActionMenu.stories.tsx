import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ActionMenu } from "./ActionMenu";

const meta = {
  title: "コンポーネント/Base/ActionMenu",
  component: ActionMenu,
  args: {
    label: "記録の操作",
    items: [
      { id: "copy", label: "curl のコマンドをコピーする", onSelect: fn() },
      { id: "replay", label: "もう一度送る", onSelect: fn() },
      { id: "delete", label: "記録を消す", onSelect: fn(), isDanger: true },
    ],
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-64 justify-end p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "記録の操作" }));
  },
};
