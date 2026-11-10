import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { type TreeNode, TreeView } from "./TreeView";

const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/index.ts", label: "index.ts" },
      {
        id: "src/routes",
        label: "routes",
        children: [
          { id: "src/routes/authorize.ts", label: "authorize.ts" },
          { id: "src/routes/token.ts", label: "token.ts" },
        ],
      },
    ],
  },
  { id: "package.json", label: "package.json" },
  { id: "README.md", label: "README.md" },
];

/** 選んだ項目を state で持つ例。 */
function TreeViewExample({
  items,
  defaultExpandedIds,
  initialSelectedId,
}: {
  items: TreeNode[];
  defaultExpandedIds?: string[];
  initialSelectedId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  return (
    <TreeView
      defaultExpandedIds={defaultExpandedIds}
      items={items}
      label="ファイル"
      onSelect={setSelectedId}
      selectedId={selectedId}
    />
  );
}

const meta = {
  title: "コンポーネント/Base/TreeView",
  component: TreeViewExample,
  args: { items: FILES },
} satisfies Meta<typeof TreeViewExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Collapsed: Story = { name: "閉じている" };
export const Expanded: Story = {
  name: "開いて選んでいる",
  args: { defaultExpandedIds: ["src", "src/routes"], initialSelectedId: "src/routes/token.ts" },
};
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
