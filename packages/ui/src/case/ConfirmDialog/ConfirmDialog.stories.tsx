import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { Button } from "../../base/Button/Button";
import { ConfirmDialog } from "./ConfirmDialog";

type ExampleProps = {
  initialOpen?: boolean;
  isConfirming?: boolean;
  onConfirm?: () => void;
};

/** ファイルの削除を確認する例。開くボタンとダイアログの組で、閉じた後のフォーカスの戻り先を確かめるのに使う。 */
function DeleteFileExample({ initialOpen = false, isConfirming = false, onConfirm }: ExampleProps) {
  const [isOpen, setOpen] = useState(initialOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">
        server.js を削除
      </Button>
      <ConfirmDialog
        confirmLabel="削除する"
        isConfirming={isConfirming}
        isOpen={isOpen}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onConfirm?.();
          setOpen(false);
        }}
        title="server.js を削除する"
      >
        src/server.js を削除する。削除したファイルは戻せない。
      </ConfirmDialog>
    </>
  );
}

const meta = {
  title: "コンポーネント/Case/ConfirmDialog",
  component: DeleteFileExample,
  args: { onConfirm: fn() },
  // showModal は文書の全体を操作できなくするので、Docs のページでは story ごとに iframe で描く
  parameters: { docs: { story: { inline: false, iframeHeight: 400 } } },
} satisfies Meta<typeof DeleteFileExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = { name: "閉じている" };
export const Open: Story = { name: "開いている", args: { initialOpen: true } };
export const Confirming: Story = {
  name: "確定の処理中",
  args: { initialOpen: true, isConfirming: true },
};
