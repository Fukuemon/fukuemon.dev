import type { Meta, StoryObj } from "@storybook/react-vite";

import { Notice } from "./Notice";

const meta = {
  title: "コンポーネント/Base/Notice",
  component: Notice,
  args: {
    tone: "info",
    title: "補足",
    children: "この記事は、認可コードフローの記事を読んだことを前提にする。",
  },
} satisfies Meta<typeof Notice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Info: Story = { name: "情報" };
export const Success: Story = {
  name: "成功",
  args: { tone: "success", title: "実行できました", children: "3 件の行を返しました。" },
};
export const Warning: Story = {
  name: "注意",
  args: { tone: "warning", title: "注意", children: "本番のデータベースでは流さない。" },
};
export const Danger: Story = {
  name: "エラー",
  args: {
    tone: "danger",
    title: "実行に失敗しました",
    children: 'relation "users" does not exist',
    isAlert: true,
  },
};
export const TitleOnly: Story = { name: "題だけ", args: { children: undefined } };
