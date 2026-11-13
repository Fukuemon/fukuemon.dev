import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./Link";

const meta = {
  title: "コンポーネント/Base/Link",
  component: Link,
  args: { href: "#article", children: "認可コードフローの記事" },
  render: (args) => (
    <p className="text-body text-text">
      詳しくは <Link {...args} />
      {" を読む。"}
    </p>
  ),
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const External: Story = {
  args: { href: "https://design.digital.go.jp/dads/", isExternal: true, children: "DADS" },
};
