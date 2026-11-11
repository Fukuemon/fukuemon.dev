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

const insert = (nodes: readonly TreeNode[], parentId: string | undefined, node: TreeNode) =>
  parentId === undefined
    ? [...nodes, node]
    : nodes.map(
        (n): TreeNode =>
          n.id === parentId
            ? { ...n, children: [...(n.children ?? []), node] }
            : n.children
              ? { ...n, children: insert(n.children, parentId, node) }
              : n,
      );

const update = (
  nodes: readonly TreeNode[],
  id: string,
  change: (node: TreeNode) => TreeNode | undefined,
): TreeNode[] =>
  nodes.flatMap((n) => {
    if (n.id === id) {
      const next = change(n);
      return next ? [next] : [];
    }
    return [n.children ? { ...n, children: update(n.children, id, change) } : n];
  });

/** 木と選んだ項目を state で持ち、作成、名前の変更、削除で木を書き換える例。渡した spy も呼ぶ。 */
function FileTreeExample(props: Omit<FileTreeProps, "onSelect">) {
  const [items, setItems] = useState(props.items);
  const [selectedId, setSelectedId] = useState(props.selectedId);
  const childId = (parentId: string | undefined, name: string) =>
    parentId === undefined ? name : `${parentId}/${name}`;
  return (
    <FileTree
      {...props}
      items={items}
      onCreate={
        props.onCreate &&
        ((name, parentId) => {
          props.onCreate?.(name, parentId);
          setItems(insert(items, parentId, { id: childId(parentId, name), label: name }));
        })
      }
      onCreateDirectory={
        props.onCreateDirectory &&
        ((name, parentId) => {
          props.onCreateDirectory?.(name, parentId);
          setItems(
            insert(items, parentId, { id: childId(parentId, name), label: name, children: [] }),
          );
        })
      }
      onDelete={
        props.onDelete &&
        ((id) => {
          props.onDelete?.(id);
          setItems(update(items, id, () => undefined));
          setSelectedId(undefined);
        })
      }
      onRename={
        props.onRename &&
        ((id, name) => {
          props.onRename?.(id, name);
          setItems(update(items, id, (node) => ({ ...node, label: name })));
        })
      }
      onSelect={setSelectedId}
      selectedId={selectedId}
    />
  );
}

const meta = {
  title: "コンポーネント/Case/FileTree",
  component: FileTreeExample,
  args: {
    items: FILES,
    defaultExpandedIds: ["src"],
    selectedId: "src/server.js",
    onCreate: fn(),
    onCreateDirectory: fn(),
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
export const NoSelection: Story = { name: "選んでいない", args: { selectedId: undefined } };
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
  args: {
    onCreate: undefined,
    onCreateDirectory: undefined,
    onRename: undefined,
    onDelete: undefined,
  },
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
