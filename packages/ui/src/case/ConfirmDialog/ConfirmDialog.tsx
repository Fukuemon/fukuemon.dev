import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "../../base/Button/Button";
import { Dialog } from "../../base/Dialog/Dialog";

export type ConfirmDialogProps = {
  /** true の間、ダイアログを開く。 */
  isOpen: boolean;
  /** ダイアログの題。失うものの名前を入れる。 */
  title: string;
  /** 本文。失うものの名前と、戻せないことを書く。 */
  children: ReactNode;
  /** 確定のボタンの文。「削除する」のように、失う操作の動詞にする。 */
  confirmLabel: string;
  /** 確定のボタンを押したときに呼ぶ。閉じるのは呼ぶ側が isOpen を false にしたときである。 */
  onConfirm: () => void;
  /** やめるのボタン、Esc のキー、閉じるボタン、背景のクリックで呼ぶ。確定の処理中は呼ばない。 */
  onCancel: () => void;
  /** true の間、確定のボタンを読み込み中にし、やめる操作を受け付けない。 */
  isConfirming?: boolean;
};

/**
 * データを失う操作を確定する前の確認。Dialog と Button を組み、確定のボタンを danger にする。
 * 開くと、やめるのボタンにフォーカスを当てる。Enter のキーを続けて押しても、誤って確定しないためである。
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 子の Dialog の effect が showModal で開いた後に動くので、開いたときの既定のフォーカスを上書きできる
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  const cancel = () => {
    if (!isConfirming) onCancel();
  };

  return (
    <Dialog
      footer={
        <>
          <Button disabled={isConfirming} onClick={cancel} ref={cancelRef} variant="secondary">
            やめる
          </Button>
          <Button isLoading={isConfirming} onClick={onConfirm} variant="danger">
            {confirmLabel}
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={cancel}
      title={title}
    >
      {children}
    </Dialog>
  );
}
