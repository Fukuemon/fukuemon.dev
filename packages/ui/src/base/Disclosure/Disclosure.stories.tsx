import type { Meta, StoryObj } from "@storybook/react-vite";

import { Disclosure } from "./Disclosure";

const meta = {
  title: "コンポーネント/Base/Disclosure",
  component: Disclosure,
  args: {
    summary: "認可コードを 1 回だけ使える理由",
    children: "認可コードを盗まれても、先に使われていれば、盗んだ側はトークンに替えられない。",
  },
} satisfies Meta<typeof Disclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = { name: "閉じている" };
export const Open: Story = { name: "開いている", args: { defaultOpen: true } };
export const Hover: Story = { name: "hover", parameters: { pseudo: { hover: true } } };
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
export const Compact: Story = {
  name: "compact",
  args: { density: "compact", defaultOpen: true },
};
