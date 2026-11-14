import { Button, ConfirmDialog, Notice } from "@fukuemon/ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { SqlSession } from "./session";

/**
 * 保存した SQL があるときだけ、「初期の状態に戻す」のボタンを出す。確認の後に保存した SQL を消し、入力欄を初期の SQL に戻す。
 * 戻した後はボタンが消えるので、フォーカスは onReset を呼んだ側が移す。
 */
export function SqlResetControl({
  session,
  disabled,
  onReset,
}: {
  session: SqlSession;
  disabled: boolean;
  onReset: () => void;
}) {
  const hasSaved = useSyncExternalStore(session.hasSaved.subscribe, session.hasSaved.getSnapshot);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);
  const moveFocus = useRef(false);

  // <dialog> が閉じた後の描画で移す。開いている間は、ページの外が inert でフォーカスを受けない
  useEffect(() => {
    if (!moveFocus.current || confirming) return;
    moveFocus.current = false;
    onReset();
  }, [confirming, onReset]);

  // 戻し終えるまで確認のダイアログを閉じない。戻せなかったときは、<dialog> がフォーカスをボタンへ戻す
  const reset = () => {
    setResetting(true);
    setFailed(false);
    session
      .reset()
      .then(() => {
        moveFocus.current = true;
      })
      .catch((error: unknown) => {
        console.error("初期の状態に戻せない", error);
        setFailed(true);
      })
      .finally(() => {
        setResetting(false);
        setConfirming(false);
      });
  };

  return (
    <>
      {hasSaved && (
        <div className="flex justify-end">
          <Button
            disabled={disabled}
            onClick={() => setConfirming(true)}
            size="XS"
            variant="secondary"
          >
            初期の状態に戻す
          </Button>
        </div>
      )}
      {failed && (
        <Notice isAlert title="初期の状態に戻せませんでした" tone="danger">
          保存した SQL を消せませんでした。入力欄は前のままです。
        </Notice>
      )}
      <ConfirmDialog
        confirmLabel="消して戻す"
        isConfirming={resetting}
        isOpen={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={reset}
        title="保存した SQL を消して、初期の状態に戻す"
      >
        保存した SQL を消し、入力欄を初期の SQL に戻します。消した SQL は戻せません。
      </ConfirmDialog>
    </>
  );
}
