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
  density,
  textSize,
}: {
  items: TreeNode[];
  defaultExpandedIds?: string[];
  initialSelectedId?: string;
  density?: "default" | "compact";
  textSize?: "compact" | "body-compact";
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  return (
    <TreeView
      defaultExpandedIds={defaultExpandedIds}
      density={density}
      items={items}
      label="ファイル"
      onSelect={setSelectedId}
      selectedId={selectedId}
      textSize={textSize}
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
export const Compact: Story = {
  name: "詰めた項目（compact）",
  args: {
    density: "compact",
    defaultExpandedIds: ["src", "src/routes"],
    initialSelectedId: "src/routes/token.ts",
  },
};
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
export const WithContent: Story = {
  name: "中身を描く",
  args: {
    items: [
      {
        id: "user",
        label: "user: {id: 42}",
        content: (
          <span>
            <span className="font-bold">user:</span> {"{id: 42}"}
          </span>
        ),
        children: [
          {
            id: "user/id",
            label: "id: 42",
            content: (
              <span>
                <span className="font-bold">id:</span> 42
              </span>
            ),
          },
        ],
      },
      { id: "name", label: "name", content: <span>名前の項目</span> },
    ],
  },
};
export const CompactBody: Story = {
  name: "13px の詰めた項目",
  args: {
    density: "compact",
    textSize: "body-compact",
    defaultExpandedIds: ["src"],
    initialSelectedId: "src/index.ts",
  },
};
