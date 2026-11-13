import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./Link";

const meta = {
  title: "コンポーネント/Base/Link",
  component: Link,
  args: { href: "#article", children: "認可コードフローの記事" },
  render: (args) => (
    <p className="text-body text-text">
      詳しくは <Link {...args} /> を読む。
    </p>
  ),
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Wrapped: Story = {
  args: { children: "認可コードフローで、認可サーバーがクライアントにコードを返すまでの記事" },
  parameters: { pseudo: { hover: true } },
  render: (args) => (
    <p className="w-64 text-body text-text">
      詳しくは <Link {...args} /> を読む。
    </p>
  ),
};
export const Standalone: Story = {
  args: { isStandalone: true },
  render: (args) => (
    <ul className="w-96 text-body text-text">
      <li className="flex items-baseline justify-between gap-4 border-b border-border py-3">
        <Link {...args} />
        <span className="text-caption text-text-secondary">2026-11-13</span>
      </li>
    </ul>
  ),
};
export const StandaloneWrapped: Story = {
  args: {
    isStandalone: true,
    children: "認可コードフローで、認可サーバーがクライアントにコードを返すまでの記事",
  },
  parameters: { pseudo: { hover: true } },
  render: (args) => (
    <ul className="w-80 text-body text-text">
      <li className="flex items-baseline justify-between gap-4 border-b border-border py-3">
        <Link {...args} />
        <span className="text-caption text-text-secondary">2026-11-13</span>
      </li>
    </ul>
  ),
};
export const External: Story = {
  args: { href: "https://design.digital.go.jp/dads/", isExternal: true, children: "DADS" },
};
