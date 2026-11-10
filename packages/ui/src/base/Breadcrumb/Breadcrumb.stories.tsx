import type { Meta, StoryObj } from "@storybook/react-vite";

import { Breadcrumb } from "./Breadcrumb";

const meta = {
  title: "コンポーネント/Base/Breadcrumb",
  component: Breadcrumb,
  args: {
    items: [
      { label: "記事", href: "#articles" },
      { label: "OAuth を手で追う", href: "#series" },
      { label: "認可コードフロー", href: "#article" },
    ],
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "デフォルト" };
export const Hover: Story = { name: "hover", parameters: { pseudo: { hover: true } } };
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
