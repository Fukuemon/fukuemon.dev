import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from "../IconButton/IconButton";
import { Button } from "./Button";

const meta = {
  title: "コンポーネント/Base/Button",
  component: Button,
  args: { children: "保存" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const PrimaryHover: Story = {
  args: { variant: "primary" },
  parameters: { pseudo: { hover: true } },
};
export const PrimaryFocus: Story = {
  args: { variant: "primary" },
  parameters: { pseudo: { focusVisible: true } },
};
export const PrimaryDisabled: Story = { args: { variant: "primary", disabled: true } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Danger: Story = { args: { variant: "danger", children: "削除" } };
export const Loading: Story = { args: { isLoading: true } };
export const SecondaryLoading: Story = { args: { variant: "secondary", isLoading: true } };
export const DangerLoading: Story = {
  args: { variant: "danger", isLoading: true, children: "削除" },
};
export const Small: Story = { args: { size: "S" } };
export const ExtraSmall: Story = {
  name: "XS",
  args: { size: "XS", variant: "secondary", children: "作る" },
};

const closeIcon = (
  <svg aria-hidden="true" height="16" viewBox="0 0 20 20" width="16">
    <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/**
 * ダークでは、compact の hover の面と、XS の無効の面が同じ色になる。2 つを文字の色で見分けられるかを確かめる見本（docs/adr/0073-layered-panes-and-radius-in-playground.md）。
 * 今の画面には、この 2 つが並ぶ所が無いので、ペインの紙の面の上に、比べる基準の hover でない IconButton と有効の XS と並べる。
 */
export const CompactHoverAndDisabledOnPane: Story = {
  name: "紙の面の上の compact の hover と XS の無効（ダーク）",
  globals: { theme: "ダーク" },
  parameters: { pseudo: { hover: ["#compact-hover"] } },
  render: () => (
    <div className="flex items-center gap-2 rounded-pane bg-surface-pane p-4">
      <IconButton density="compact" icon={closeIcon} label="消す" />
      <IconButton density="compact" icon={closeIcon} id="compact-hover" label="閉じる" />
      <Button size="XS" variant="secondary">
        保存
      </Button>
      <Button disabled size="XS" variant="secondary">
        作る
      </Button>
      <Button disabled size="XS">
        実行
      </Button>
    </div>
  ),
};
