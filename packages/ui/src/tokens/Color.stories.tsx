import type { Meta, StoryObj } from "@storybook/react-vite";

const GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: "面",
    tokens: ["surface", "surface-subtle", "surface-raised", "surface-disabled", "overlay"],
  },
  { title: "文字", tokens: ["text", "text-secondary", "text-disabled", "text-inverse"] },
  { title: "枠", tokens: ["border", "border-field"] },
  {
    title: "操作",
    tokens: [
      "primary",
      "primary-hover",
      "primary-surface",
      "link",
      "link-visited",
      "link-external",
      "current-page",
    ],
  },
  { title: "フォーカス", tokens: ["focus-outline", "focus-halo"] },
  {
    title: "状態",
    tokens: [
      "danger",
      "danger-surface",
      "warning",
      "warning-surface",
      "success",
      "success-surface",
      "info",
      "info-surface",
    ],
  },
  {
    title: "区別",
    tokens: [1, 2, 3, 4, 5, 6].map((n) => `categorical-${n}`),
  },
];

/** セマンティックトークンの色を、種類ごとに見本と名前で並べる。 */
function ColorTokens() {
  return (
    <div className="flex flex-col gap-8 bg-surface p-6 text-text">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="font-heading text-heading-md font-semibold">{group.title}</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {group.tokens.map((token) => (
              <li key={token} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-10 shrink-0 border border-border-field"
                  style={{ backgroundColor: `var(--fd-color-${token})` }}
                />
                <code className="font-mono text-code-dense">{token}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: "トークン/色",
  component: ColorTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ColorTokens>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = { name: "ライト", globals: { theme: "ライト" } };

export const Dark: Story = { name: "ダーク", globals: { theme: "ダーク" } };
