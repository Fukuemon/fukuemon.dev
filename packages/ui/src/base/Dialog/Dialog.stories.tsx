import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

/** 開くボタンとダイアログの組。閉じた後のフォーカスの戻り先を確かめるのに使う。 */
function DialogExample({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setOpen] = useState(initialOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">
        記録を消す
      </Button>
      <Dialog
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="secondary">
              やめる
            </Button>
            <Button onClick={() => setOpen(false)} variant="danger">
              消す
            </Button>
          </>
        }
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title="HTTP の記録を消す"
      >
        記録した 12 件の行き来を消す。消した記録は戻せない。
      </Dialog>
    </>
  );
}

const meta = {
  title: "コンポーネント/Base/Dialog",
  component: DialogExample,
  // showModal は文書の全体を操作できなくするので、Docs のページでは story ごとに iframe で描く
  parameters: { docs: { story: { inline: false, iframeHeight: 400 } } },
} satisfies Meta<typeof DialogExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { initialOpen: true } };
