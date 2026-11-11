import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileIcon } from "./FileIcon";

const meta = {
  title: "コンポーネント/Base/FileIcon",
  component: FileIcon,
  args: { kind: "file", name: "main.ts" },
} satisfies Meta<typeof FileIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Code: Story = { name: "コード", args: { name: "main.ts" } };
export const Document: Story = { name: "文書", args: { name: "README.md" } };
export const Data: Story = { name: "データ", args: { name: "package.json" } };
export const Other: Story = { name: "そのほか", args: { name: "LICENSE" } };
export const Directory: Story = { name: "ディレクトリ", args: { kind: "directory" } };
export const DirectoryOpen: Story = {
  name: "開いたディレクトリ",
  args: { kind: "directory", isOpen: true },
};

export const All: Story = {
  name: "一覧",
  render: () => (
    <ul className="flex flex-col gap-2 p-4 text-body-dense text-text">
      {[
        ["directory", "", false],
        ["directory", "", true],
        ["file", "main.ts", false],
        ["file", "README.md", false],
        ["file", "package.json", false],
        ["file", "LICENSE", false],
      ].map(([kind, name, isOpen]) => (
        <li className="flex items-center gap-2" key={`${kind}-${name}-${isOpen}`}>
          <FileIcon
            isOpen={isOpen === true}
            kind={kind as "file" | "directory"}
            name={name as string}
          />
          {name === "" ? (isOpen ? "開いたディレクトリ" : "ディレクトリ") : name}
        </li>
      ))}
    </ul>
  ),
};
