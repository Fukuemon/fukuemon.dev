import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextField } from "./TextField";

const meta = {
  title: "コンポーネント/Base/TextField",
  component: TextField,
  args: { label: "リダイレクト先の URL", name: "redirect_uri" },
  decorators: [
    (Story) => (
      <div className="max-w-96 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDescription: Story = {
  args: { description: "認可サーバーに登録した URL と同じにする", required: true },
};
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Error: Story = {
  args: { defaultValue: "example.com", error: "https:// で始まる URL を入れる" },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: "https://example.com/cb" } };
export const LabelHidden: Story = { args: { isLabelHidden: true } };
export const Underline: Story = { args: { appearance: "underline", placeholder: "記事を検索" } };
export const Compact: Story = {
  name: "compact",
  args: {
    density: "compact",
    label: "プレビューの URL",
    isLabelHidden: true,
    readOnly: true,
    value: "https://client.example:3000/",
  },
};
