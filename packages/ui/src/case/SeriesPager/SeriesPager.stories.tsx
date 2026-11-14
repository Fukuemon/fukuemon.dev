import type { Meta, StoryObj } from "@storybook/react-vite";

import { SeriesPager } from "./SeriesPager";

const PREV = { title: "認可のリクエストを組み立てる", href: "#authorize" };
const NEXT = { title: "リフレッシュトークンを回す", href: "#refresh-token" };

const meta = {
  title: "コンポーネント/Case/SeriesPager",
  component: SeriesPager,
  args: { series: "OAuth を手で追う", position: 3, total: 5, prev: PREV, next: NEXT },
  decorators: [
    (Story) => (
      <div className="max-w-body p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SeriesPager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Middle: Story = { name: "前後あり" };
export const First: Story = { name: "最初の記事", args: { position: 1, prev: undefined } };
export const Last: Story = { name: "最後の記事", args: { position: 5, next: undefined } };
export const LongTitle: Story = {
  name: "長い題の hover",
  args: {
    next: {
      title: "リフレッシュトークンを回し、古いトークンが使われたら全てのトークンを取り消す",
      href: "#refresh-token",
    },
  },
  parameters: { pseudo: { hover: true } },
};
