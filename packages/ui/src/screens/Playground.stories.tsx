import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { TreeNode } from "../base/TreeView/TreeView";
import { type EditorFile, EditorFrame } from "../case/EditorFrame/EditorFrame";
import { FileTree } from "../case/FileTree/FileTree";
import { HttpExchangeDetail } from "../case/HttpExchangeDetail/HttpExchangeDetail";
import { HttpExchangeList, type HttpExchange } from "../case/HttpExchangeList/HttpExchangeList";
import { ACTORS, EXCHANGES, LONG_EXCHANGE } from "../case/HttpExchangeList/fixtures";
import { PreviewFrame } from "../case/PreviewFrame/PreviewFrame";
import { TerminalFrame } from "../case/TerminalFrame/TerminalFrame";
import { DummyEngine, SOURCE_LINES, TERMINAL_LINES } from "../case/ToolPane/fixtures";

const meta = {
  title: "画面/コードを動かす画面",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

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

const OPEN_FILES: EditorFile[] = [
  { id: "src/server.js", label: "server.js" },
  { id: "src/callback.js", label: "callback.js" },
];

/** ファイルのツリー、エディタ、端末、プレビュー、HTTP の流れを並べた画面。幅 48rem 未満では、領域を縦に積む。 */
function Playground({ exchanges }: { exchanges: readonly HttpExchange[] }) {
  const [fileId, setFileId] = useState("src/server.js");
  const [exchangeId, setExchangeId] = useState(exchanges.at(-1)?.id);
  const exchange = exchanges.find((e) => e.id === exchangeId);
  return (
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b-2 border-text px-6">
        <div className="flex min-h-16 items-center">
          <h1 className="font-heading text-heading-md font-semibold">認可コードを受け取る</h1>
        </div>
      </header>
      <main className="flex flex-col gap-4 p-4 md:flex-row">
        <div className="flex flex-col md:w-64 md:shrink-0">
          <FileTree
            defaultExpandedIds={["src"]}
            items={FILES}
            onCreate={() => {}}
            onDelete={() => {}}
            onRename={() => {}}
            onSelect={setFileId}
            selectedId={fileId}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <EditorFrame files={OPEN_FILES} onSelect={setFileId} selectedId={fileId}>
            {(theme, file) => (
              <DummyEngine label={`${file.label} のコード`} lines={SOURCE_LINES} theme={theme} />
            )}
          </EditorFrame>
          <TerminalFrame>
            {(theme) => <DummyEngine label="端末の出力" lines={TERMINAL_LINES} theme={theme} />}
          </TerminalFrame>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PreviewFrame onReload={() => {}} url="https://client.example:3000/">
            <iframe srcDoc="<p>ダミーのプレビュー</p>" title="プレビューの画面" />
          </PreviewFrame>
          <HttpExchangeList
            actors={ACTORS}
            exchanges={exchanges}
            onSelect={setExchangeId}
            selectedId={exchangeId}
          />
          <HttpExchangeDetail actors={ACTORS} exchange={exchange} />
        </div>
      </main>
    </div>
  );
}

export const Default: Story = {
  name: "コードを動かす画面",
  render: () => <Playground exchanges={EXCHANGES} />,
};

export const LongData: Story = {
  name: "長い URL とヘッダ",
  render: () => <Playground exchanges={[...EXCHANGES, LONG_EXCHANGE]} />,
};
