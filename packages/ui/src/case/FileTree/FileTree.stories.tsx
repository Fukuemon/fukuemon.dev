import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import type { TreeNode } from "../../base/TreeView/TreeView";
import { FileTree, type FileTreeProps } from "./FileTree";

const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/server.js", label: "server.js" },
      { id: "src/callback.js", label: "callback.js" },
    ],
  },
  { id: "package.json", label: "package.json" },
];

/** 選んだ項目を state で持つ例。 */
function FileTreeExample(props: Omit<FileTreeProps, "onSelect">) {
  const [selectedId, setSelectedId] = useState(props.selectedId);
  return <FileTree {...props} onSelect={setSelectedId} selectedId={selectedId} />;
}

const meta = {
  title: "コンポーネント/Case/FileTree",
  component: FileTreeExample,
  args: {
    items: FILES,
    defaultExpandedIds: ["src"],
    selectedId: "src/server.js",
    onCreate: fn(),
    onRename: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-96 max-w-96 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileTreeExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "選んでいる" };
export const Creating: Story = {
  name: "新しいファイルの名前を入れている",
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "新しいファイル" }));
  },
};
export const Menu: Story = {
  name: "操作のメニューを開いている",
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "server.js の操作" }));
  },
};
export const ReadOnly: Story = {
  name: "操作なし",
  args: { onCreate: undefined, onRename: undefined, onDelete: undefined },
};
export const Empty: Story = { name: "空", args: { items: [], selectedId: undefined } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "ファイルを読み込んでいます" } },
};
export const Error: Story = {
  name: "エラー",
  args: { state: { kind: "error", title: "ファイルの一覧を読めませんでした" } },
};
