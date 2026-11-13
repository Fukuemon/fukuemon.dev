import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { TreeNode } from "../base/TreeView/TreeView";
import { ConfirmDialog } from "../case/ConfirmDialog/ConfirmDialog";
import { type ConsoleEntry, ConsoleEntryList } from "../case/ConsoleEntryList/ConsoleEntryList";
import { ENTRIES, LONG_ENTRY } from "../case/ConsoleEntryList/fixtures";
import { type EditorFile, EditorFrame } from "../case/EditorFrame/EditorFrame";
import { FileTree } from "../case/FileTree/FileTree";
import { HttpExchangeDetail } from "../case/HttpExchangeDetail/HttpExchangeDetail";
import { HttpExchangeList, type HttpExchange } from "../case/HttpExchangeList/HttpExchangeList";
import { ACTORS, EXCHANGES, LONG_EXCHANGE } from "../case/HttpExchangeList/fixtures";
import { PreviewFrame } from "../case/PreviewFrame/PreviewFrame";
import { TerminalFrame } from "../case/TerminalFrame/TerminalFrame";
import { DummyEngine, DummyPreview, SOURCE_LINES, TERMINAL_LINES } from "../case/ToolPane/fixtures";

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

const findNode = (nodes: readonly TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children && findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
};

const removeNode = (nodes: readonly TreeNode[], id: string): TreeNode[] =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeNode(node.children, id) } : node));

/** ファイルのツリー、エディタ、端末、プレビュー、HTTP の流れ、コンソールを並べた画面。幅 48rem 未満では、領域を縦に積む。 */
function Playground({
  exchanges,
  consoleEntries,
}: {
  exchanges: readonly HttpExchange[];
  consoleEntries: readonly ConsoleEntry[];
}) {
  const [files, setFiles] = useState<readonly TreeNode[]>(FILES);
  const [fileId, setFileId] = useState<string | undefined>("src/server.js");
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const deleting = deletingId === undefined ? undefined : findNode(files, deletingId);
  const openFiles = OPEN_FILES.filter((file) => findNode(files, file.id) !== undefined);
  const [exchangeId, setExchangeId] = useState(exchanges.at(-1)?.id);
  const exchange = exchanges.find((e) => e.id === exchangeId);
  return (
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b-2 border-text px-6">
        <div className="flex min-h-16 items-center">
          <h1 className="font-heading text-heading-md font-semibold">認可コードを受け取る</h1>
        </div>
      </header>
      <main className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
        {/* 左の 2 列は、右の列の高さに伸びず、自分の中身の高さで止める。伸ばすと、エディタが伸びて端末が最初の画面の外へ出る */}
        <div className="flex min-w-0 flex-col gap-4 md:flex-2 md:flex-row">
          <div className="grid md:w-64 md:shrink-0">
            <FileTree
              defaultExpandedIds={["src"]}
              items={files}
              onCreate={() => {}}
              onCreateDirectory={() => {}}
              onDelete={setDeletingId}
              onRename={() => {}}
              onSelect={setFileId}
              selectedId={fileId}
            />
            <ConfirmDialog
              confirmLabel="削除する"
              isOpen={deleting !== undefined}
              onCancel={() => setDeletingId(undefined)}
              onConfirm={() => {
                if (deletingId === undefined) return;
                setFiles(removeNode(files, deletingId));
                if (fileId === deletingId) setFileId(undefined);
                setDeletingId(undefined);
              }}
              title={`${deleting?.label ?? ""} を削除する`}
            >
              {deleting?.children
                ? `${deleting.label} と、中のファイルを全て削除する。`
                : `${deletingId} を削除する。`}
              削除したファイルは戻せない。
            </ConfirmDialog>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <EditorFrame
              files={openFiles}
              onSelect={setFileId}
              selectedId={fileId}
              status={
                <>
                  <span>JavaScript</span>
                  <span>UTF-8 · 行 4、列 12</span>
                </>
              }
            >
              {(theme, file) => (
                <DummyEngine
                  label={`${file.label} のコード`}
                  lines={SOURCE_LINES}
                  theme={theme}
                  variant="source"
                />
              )}
            </EditorFrame>
            <TerminalFrame>
              {(theme) => <DummyEngine label="端末の出力" lines={TERMINAL_LINES} theme={theme} />}
            </TerminalFrame>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PreviewFrame onReload={() => {}} url="https://client.example:3000/">
            <DummyPreview />
          </PreviewFrame>
          <HttpExchangeList
            actors={ACTORS}
            exchanges={exchanges}
            onSelect={setExchangeId}
            selectedId={exchangeId}
          />
          <HttpExchangeDetail actors={ACTORS} exchange={exchange} />
          <ConsoleEntryList entries={consoleEntries} />
        </div>
      </main>
    </div>
  );
}

export const Default: Story = {
  name: "コードを動かす画面",
  render: () => <Playground consoleEntries={ENTRIES} exchanges={EXCHANGES} />,
};

export const LongData: Story = {
  name: "長い URL とヘッダ",
  render: () => (
    <Playground
      consoleEntries={[...ENTRIES, LONG_ENTRY]}
      exchanges={[...EXCHANGES, LONG_EXCHANGE]}
    />
  ),
};
