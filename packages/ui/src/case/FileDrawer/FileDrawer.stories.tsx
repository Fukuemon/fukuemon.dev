import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "../../base/Button/Button";
import { FileDrawer } from "./FileDrawer";

/** 開くボタンとドロワーの組。閉じた後のフォーカスの戻り先を確かめるのに使う。 */
function FileDrawerExample({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setOpen] = useState(initialOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">
        ファイルを開く
      </Button>
      <FileDrawer
        description="ファイルを選ぶと、エディタで開きます"
        initialFocus='[aria-current="true"]'
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title="Node の実行環境"
      >
        <ul className="flex flex-col p-1 text-body-compact">
          {["index.js", "package.json"].map((name) => (
            <li key={name}>
              <button
                aria-current={name === "package.json" ? "true" : undefined}
                className="h-11 w-full px-3 text-left focus-visible:focus-ring-inset"
                onClick={() => setOpen(false)}
                type="button"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      </FileDrawer>
    </>
  );
}

const meta = {
  title: "コンポーネント/Case/FileDrawer",
  component: FileDrawerExample,
  // showModal は文書の全体を操作できなくするので、Docs のページでは story ごとに iframe で描く
  parameters: { docs: { story: { inline: false, iframeHeight: 480 } } },
} satisfies Meta<typeof FileDrawerExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { initialOpen: true } };
