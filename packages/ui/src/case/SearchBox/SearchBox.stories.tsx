import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { SearchBox } from "./SearchBox";

const meta = {
  title: "コンポーネント/Case/SearchBox",
  component: SearchBox,
  args: {
    label: "記事を検索",
    action: "#search",
    suggestions: [],
    onQueryChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-64 max-w-96 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchBox>;

export default meta;

type Story = StoryObj<typeof meta>;

const SUGGESTIONS = [
  { title: "認可コードフローを手で追う", url: "#authorization-code" },
  { title: "PKCE の code_verifier を作る", url: "#pkce" },
  { title: "リフレッシュトークンを回す", url: "#refresh-token" },
];

export const Empty: Story = { name: "空" };
export const WithSuggestions: Story = {
  name: "候補あり",
  args: { defaultQuery: "認可", suggestions: SUGGESTIONS },
};
export const SuggestionSelected: Story = {
  name: "候補を選んだ状態",
  args: { defaultQuery: "認可", suggestions: SUGGESTIONS },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
  },
};
