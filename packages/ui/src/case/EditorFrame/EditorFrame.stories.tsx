import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { DummyEngine, SOURCE_LINES } from "../ToolPane/fixtures";
import { type EditorFile, EditorFrame, type EditorFrameProps } from "./EditorFrame";

const FILES: EditorFile[] = [
  { id: "server.js", label: "server.js" },
  { id: "package.json", label: "package.json" },
];

/** 開いたファイルと選んだファイルを state で持つ例。 */
function EditorFrameExample(
  props: Pick<EditorFrameProps, "files" | "state" | "themeName"> & { isClosable?: boolean },
) {
  const [files, setFiles] = useState(props.files);
  const [selectedId, setSelectedId] = useState(props.files[0]?.id);
  return (
    <EditorFrame
      files={files}
      onClose={
        props.isClosable
          ? (id) => setFiles((current) => current.filter((file) => file.id !== id))
          : undefined
      }
      onSelect={setSelectedId}
      selectedId={selectedId}
      state={props.state}
      themeName={props.themeName}
    >
      {(theme, file) => (
        <DummyEngine label={`${file.label} のコード`} lines={SOURCE_LINES} theme={theme} />
      )}
    </EditorFrame>
  );
}

const meta = {
  title: "コンポーネント/Case/EditorFrame",
  component: EditorFrameExample,
  args: { files: FILES },
  decorators: [
    (Story) => (
      <div className="max-w-prose p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorFrameExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "ファイルを開いている" };
export const Closable: Story = { name: "閉じられるタブ", args: { isClosable: true } };
export const Empty: Story = { name: "空", args: { files: [] } };
export const Loading: Story = {
  name: "読み込み中",
  args: { state: { kind: "loading", label: "エディタを読み込んでいます" } },
};
export const Error: Story = {
  name: "エラー",
  args: { state: { kind: "error", title: "エディタを読み込めませんでした" } },
};
